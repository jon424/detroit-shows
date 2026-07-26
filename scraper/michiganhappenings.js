import * as cheerio from "cheerio";

const PAGE_URL = "https://michiganhappenings.org/public/";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_PATTERN = DAYS.join("|");
const DATE_LINE_RE = new RegExp(`^(${DAY_PATTERN})\\s+(\\d{1,2})/(\\d{1,2})$`);

// Venues already scraped by dedicated scrapers — skip to avoid duplicates
const DEDICATED_VENUES = new Set([
  "trinosophes",
  "moondog",
  "cliff bell's",
  "blue llama",
  "the blue llama",
  "motor city wine",
]);

// Map venue names from Michigan Happenings to canonical names used in our system
const VENUE_MAP = {
  "outer limits lounge": "Outer Limits",
  "outer limits": "Outer Limits",
  "paris bar": "Paris Bar",
  "trinosophes": "trinosophes",
  "cliff bell's": "Cliff Bell's",
  "blue llama": "The Blue Llama",
  "the blue llama": "The Blue Llama",
  "motor city wine": "Motor City Wine",
  "candela": "Candela",
  "michigan theater": "Michigan Theater",
  "the magic bag": "The Magic Bag",
  "magic bag": "The Magic Bag",
  "magic stick": "Magic Stick",
  "majestic theatre": "Majestic Theatre",
  "majestic theater": "Majestic Theatre",
};

function normalizeVenue(raw) {
  const lower = raw.toLowerCase().trim();
  return VENUE_MAP[lower] || raw.trim();
}

function isDedicatedVenue(venue) {
  return DEDICATED_VENUES.has(venue.toLowerCase().trim());
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

export async function scrapeMichiganHappenings() {
  const res = await fetch(PAGE_URL);
  if (!res.ok) throw new Error(`Michigan Happenings fetch failed: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const events = [];
  const today = new Date().toISOString().slice(0, 10);

  // The page puts dates on one line and event details on the next
  const bodyText = $("body").text();
  const lines = bodyText.split("\n").map((l) => l.trim()).filter(Boolean);

  // Pair each date line with the following details line
  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    const dateMatch = lines[i].match(DATE_LINE_RE);
    if (dateMatch && i + 1 < lines.length) {
      entries.push({ dateMatch, details: lines[i + 1] });
    }
  }

  for (const { dateMatch, details } of entries) {
    const month = parseInt(dateMatch[2], 10);
    const day = parseInt(dateMatch[3], 10);
    const rest = details;

    const year = inferYear(month, day);
    const eventDate = formatDate(year, month, day);
    if (eventDate < today) continue;

    // Details line format: [time] • [series name] title • venue [(address)] [• price]
    // Split by bullet separator •
    const parts = rest.split("•").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;

    // First part may be just the time (e.g. "7pm") or empty if no time
    // The title/artists are in the second part, venue in third, price in fourth
    // But sometimes the time is joined with the title in the first bullet section

    let startTime = null;
    let title = "";
    let venuePart = "";
    let price = null;

    // Check if first part is just a time
    if (/^\d{1,2}(?::\d{2})?\s*(?:am|pm)$/i.test(parts[0])) {
      startTime = parseTime(parts[0]);
      title = parts[1] || "";
      venuePart = parts[2] || "";
      price = parts[3] || null;
    } else {
      // Time might be embedded in first part, or no time at all
      startTime = parseTime(parts[0]);
      title = parts[0].replace(/^\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*/i, "").trim();
      venuePart = parts[1] || "";
      price = parts[2] || null;
    }

    title = title.replace(/^[•·\s]+|[•·\s]+$/g, "").trim();
    if (!title) continue;

    // Extract venue name (strip address in parentheses)
    const venueRaw = venuePart.replace(/\s*\(.*?\)\s*$/, "").trim();
    if (!venueRaw) continue;

    // Skip venues that have their own dedicated scrapers
    if (isDedicatedVenue(venueRaw)) continue;

    const venue = normalizeVenue(venueRaw);

    const description = price ? price.trim() : null;

    events.push({
      venue,
      title,
      description,
      event_date: eventDate,
      start_time: startTime || null,
      source_url: PAGE_URL,
      venue_url: PAGE_URL,
    });
  }

  console.log(`[Michigan Happenings] Scraped ${events.length} upcoming events`);
  return events;
}
