import * as cheerio from "cheerio";

const CALENDAR_URL = "https://bluellamaclub.com/tickets-calendar/";

function parseSetTime(text) {
  if (!text) return null;
  const match = text.match(/Sets?\s+(\d{1,2})(:\d{2})?\s*(am|pm)/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? match[2].slice(1) : "00";
  const period = match[3].toLowerCase();
  if (period === "pm" && hours !== 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

export async function scrapeBlueLlama() {
  const res = await fetch(CALENDAR_URL);
  if (!res.ok) throw new Error(`Blue Llama fetch failed: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const events = [];
  const today = new Date().toISOString().slice(0, 10);

  $(".tribe-events-calendar-list__event-row").each((_, row) => {
    const $row = $(row);

    const dateTag = $row.find(
      "time.tribe-events-calendar-list__event-date-tag-datetime"
    );
    const eventDate = dateTag.attr("datetime") || null;

    const titleLink = $row.find(
      ".tribe-events-calendar-list__event-title-link"
    );
    const title = titleLink.text().trim();
    const eventLink = titleLink.attr("href") || CALENDAR_URL;

    const datetimeText = $row
      .find(".tribe-events-calendar-list__event-datetime")
      .text();
    const startTime = parseSetTime(datetimeText);

    const description =
      $row
        .find(".tribe-events-calendar-list__event-description p")
        .first()
        .text()
        .trim() || null;

    if (title && eventDate && eventDate >= today) {
      events.push({
        venue: "The Blue Llama",
        title,
        description,
        event_date: eventDate,
        start_time: startTime,
        source_url: eventLink,
        venue_url: CALENDAR_URL,
      });
    }
  });

  console.log(`[Blue Llama] Scraped ${events.length} upcoming events`);
  return events;
}
