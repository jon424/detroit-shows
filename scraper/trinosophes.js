import * as cheerio from "cheerio";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_PATTERN = MONTHS.join("|");
const DATE_RE = new RegExp(
  `(${MONTH_PATTERN})\\s+(\\d{1,2})(?:\\s*(?:&amp;|&|and|–|-|\\u2013)\\s*(\\d{1,2}))?`,
  "g"
);

function monthToNumber(name) {
  return MONTHS.indexOf(name) + 1;
}

function inferYear(month, day) {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), month - 1, day);
  // If the date is more than 30 days in the past, assume next year
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

function cleanText(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function scrapeTrinosophes() {
  const res = await fetch("https://trinosophes.com/Events");
  if (!res.ok) throw new Error(`Trinosophes fetch failed: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  // The events page has multiple <projectcontent> blocks.
  // The COMING SOON section is in the second one.
  const contentBlocks = $("projectcontent").toArray();
  if (contentBlocks.length < 2) {
    throw new Error("Could not find events content on Trinosophes page");
  }

  const eventsHtml = $(contentBlocks[1]).html();
  // Extract from "COMING SOON" to the first <hr> — that's the upcoming events
  const comingSoonIdx = eventsHtml.indexOf("COMING SOON");
  const hrIdx = eventsHtml.indexOf("<hr", comingSoonIdx);
  if (comingSoonIdx === -1 || hrIdx === -1) {
    throw new Error("Could not locate COMING SOON section");
  }

  const upcomingHtml = eventsHtml.slice(comingSoonIdx, hrIdx);
  const upcomingText = cleanText(upcomingHtml);

  // Split on date patterns to extract individual events
  const events = [];
  const lines = upcomingText.split("\n").map((l) => l.trim()).filter(Boolean);

  // Skip the "COMING SOON" header line and any recurring series preamble
  let i = 0;
  while (i < lines.length && !lines[i].match(new RegExp(`^(${MONTH_PATTERN})\\s+\\d`))) {
    i++;
  }

  while (i < lines.length) {
    const dateMatch = lines[i].match(
      new RegExp(`^(${MONTH_PATTERN})\\s+(\\d{1,2})(?:\\s*(?:&|and|–|-|\\u2013)\\s*(\\d{1,2}))?`)
    );
    if (!dateMatch) {
      i++;
      continue;
    }

    const monthName = dateMatch[1];
    const day = parseInt(dateMatch[2], 10);
    const month = monthToNumber(monthName);
    const year = inferYear(month, day);
    const dateStr = formatDate(year, month, day);

    // The remainder of this line after the date (if any)
    const restOfDateLine = lines[i].slice(dateMatch[0].length).trim();

    // Collect title/description lines until the next date line
    const descLines = [];
    if (restOfDateLine) descLines.push(restOfDateLine);
    i++;
    while (
      i < lines.length &&
      !lines[i].match(new RegExp(`^(${MONTH_PATTERN})\\s+\\d`))
    ) {
      descLines.push(lines[i]);
      i++;
    }

    const title = descLines[0] || "Event";
    const description = descLines.length > 1 ? descLines.slice(1).join("\n") : null;

    // Skip non-event entries
    if (/closed for a private event/i.test(title)) continue;

    events.push({
      venue: "trinosophes",
      title,
      description,
      event_date: dateStr,
      source_url: "https://trinosophes.com/Events",
    });
  }

  console.log(`[Trinosophes] Scraped ${events.length} upcoming events`);
  return events;
}
