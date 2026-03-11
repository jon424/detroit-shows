import puppeteer from "puppeteer";

function parseEventDate(text) {
  if (!text) return null;
  // Squarespace typically renders dates like "Mar 27, 2026" or "April 18, 2026"
  const d = new Date(text);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseStartTime(text) {
  if (!text) return null;
  // Match patterns like "7:00 PM", "19:00", "Doors at 8pm"
  const match = text.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3].toLowerCase();
  if (meridiem === "pm" && hours !== 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export async function scrapeMoondog() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto("https://www.moondogcafedetroit.com/calendar", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for Squarespace content to render
    await page.waitForFunction(
      () => document.querySelector(".eventlist, .events-list, .sqs-events, [class*='event']"),
      { timeout: 10000 }
    ).catch(() => {
      // If specific selectors aren't found, the page may use a different layout
    });

    // Extra time for any lazy-loaded content
    await new Promise((r) => setTimeout(r, 3000));

    const events = await page.evaluate(() => {
      const results = [];

      // Strategy 1: Standard Squarespace event list selectors
      const eventItems = document.querySelectorAll(
        ".eventlist-event, .eventlist-event--upcoming"
      );
      if (eventItems.length > 0) {
        eventItems.forEach((el) => {
          const titleEl = el.querySelector(
            ".eventlist-title, .eventlist-title-link, h1, h2"
          );
          const dateEl = el.querySelector(
            ".event-date, .eventlist-datetag, .eventlist-datetag-startdate, time"
          );
          const metaEl = el.querySelector(
            ".eventlist-meta, .eventlist-meta-time"
          );
          const descEl = el.querySelector(
            ".eventlist-description, .eventlist-excerpt"
          );

          results.push({
            title: titleEl?.textContent?.trim() || "",
            dateText: dateEl?.textContent?.trim() || dateEl?.getAttribute("datetime") || "",
            timeText: metaEl?.textContent?.trim() || "",
            description: descEl?.textContent?.trim() || "",
          });
        });
        return results;
      }

      // Strategy 2: Modern Squarespace list-item layout
      const listItems = document.querySelectorAll(
        ".user-items-list-item-container, .list-item"
      );
      if (listItems.length > 0) {
        listItems.forEach((el) => {
          const titleEl = el.querySelector(
            "[class*='title'], h1, h2, h3"
          );
          const dateEl = el.querySelector(
            "time, [class*='date'], [class*='meta']"
          );
          const descEl = el.querySelector("[class*='description'], [class*='excerpt'], p");

          results.push({
            title: titleEl?.textContent?.trim() || "",
            dateText: dateEl?.textContent?.trim() || dateEl?.getAttribute("datetime") || "",
            timeText: "",
            description: descEl?.textContent?.trim() || "",
          });
        });
        return results;
      }

      // Strategy 3: Generic fallback — look for any structured event-like data
      const anyEvents = document.querySelectorAll(
        "[data-type='events'] article, .sqs-block-content article, .summary-item"
      );
      anyEvents.forEach((el) => {
        const titleEl = el.querySelector("h1, h2, h3, a");
        const dateEl = el.querySelector("time, [class*='date']");
        const descEl = el.querySelector("p, [class*='excerpt']");

        results.push({
          title: titleEl?.textContent?.trim() || "",
          dateText: dateEl?.textContent?.trim() || dateEl?.getAttribute("datetime") || "",
          timeText: "",
          description: descEl?.textContent?.trim() || "",
        });
      });

      return results;
    });

    const parsed = events
      .filter((e) => e.title)
      .map((e) => ({
        venue: "moondog",
        title: e.title,
        description: e.description || null,
        event_date: parseEventDate(e.dateText),
        start_time: parseStartTime(e.timeText) || null,
        source_url: "https://www.moondogcafedetroit.com/calendar",
      }));

    console.log(`[Moondog] Scraped ${parsed.length} upcoming events`);
    return parsed;
  } finally {
    await browser.close();
  }
}
