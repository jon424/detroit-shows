import * as cheerio from "cheerio";

const PAGE_URL = "https://motorcitywine.com/upcoming-events/";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthToNumber(name) {
  return MONTHS.indexOf(name) + 1;
}

function inferYear(month, day) {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), month - 1, day);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  if (candidate < thirtyDaysAgo) {
    return now.getFullYear() + 1;
  }
  return now.getFullYear();
}

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseTime(text) {
  if (!text) return null;
  const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] || "00";
  const period = match[3].toLowerCase();
  if (period === "pm" && hours !== 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;
  return `${String(hours).padStart(2, "0")}:${minutes}`;
}

const DATE_RE = new RegExp(
  `(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\\s+(${MONTHS.join("|")})\\s+(\\d{1,2})(?:st|nd|rd|th)?`,
  "i"
);

export async function scrapeMotorCityWine() {
  const pageRes = await fetch(PAGE_URL);
  if (!pageRes.ok) throw new Error(`Motor City Wine page fetch failed: ${pageRes.status}`);

  const pageHtml = await pageRes.text();
  const $page = cheerio.load(pageHtml);

  let iframeSrc = null;
  $page("iframe").each((_, el) => {
    const src = $page(el).attr("src") || "";
    if (src.includes("mailerlite")) iframeSrc = src;
  });
  if (!iframeSrc) {
    throw new Error("Could not find MailerLite iframe on Motor City Wine page");
  }

  const nlRes = await fetch(iframeSrc);
  if (!nlRes.ok) throw new Error(`Motor City Wine newsletter fetch failed: ${nlRes.status}`);

  const nlHtml = await nlRes.text();
  const $ = cheerio.load(nlHtml);

  const events = [];
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set();

  $("td").each((_, td) => {
    const $td = $(td);
    const heading = $td.find("h1, h2, h3, p strong, p b").first();
    if (!heading.length) return;

    const title = heading.text().trim();
    if (!title || title.length < 3 || seen.has(title)) return;

    const fullText = $td.text().replace(/\s+/g, " ").trim();
    if (fullText.length < 20 || fullText.length > 600) return;

    seen.add(title);

    const dateMatch = fullText.match(DATE_RE);
    if (!dateMatch) return;

    const month = monthToNumber(dateMatch[1]);
    const day = parseInt(dateMatch[2], 10);
    const year = inferYear(month, day);
    const eventDate = formatDate(year, month, day);

    if (eventDate < today) return;

    const afterDate = fullText.slice(
      fullText.indexOf(dateMatch[0]) + dateMatch[0].length
    );
    const startTime = parseTime(afterDate);

    const description = afterDate.replace(/^\s*(?:st|nd|rd|th)?\s*/, "").trim() || null;

    events.push({
      venue: "Motor City Wine",
      title,
      description,
      event_date: eventDate,
      start_time: startTime,
      source_url: PAGE_URL,
      venue_url: PAGE_URL,
    });
  });

  console.log(`[Motor City Wine] Scraped ${events.length} upcoming events`);
  return events;
}
