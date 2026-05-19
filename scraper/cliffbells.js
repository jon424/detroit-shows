import * as cheerio from "cheerio";

const SHOWS_URL = "https://cliffbells.com/shows/";

function parseTime24(datetimeAttr) {
  if (!datetimeAttr) return null;
  const match = datetimeAttr.match(/^(\d{2}):(\d{2})$/);
  return match ? `${match[1]}:${match[2]}` : null;
}

export async function scrapeCliffBells() {
  const res = await fetch(SHOWS_URL);
  if (!res.ok) throw new Error(`Cliff Bell's fetch failed: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const events = [];
  const today = new Date().toISOString().slice(0, 10);

  $(".type-tribe_events").each((_, el) => {
    const $el = $(el);

    const titleLink = $el.find(
      ".tribe-events-pro-photo__event-title-link, h3 a"
    ).first();
    const title = titleLink.text().trim();
    const eventLink = titleLink.attr("href") || SHOWS_URL;

    const dateTag = $el.find(
      "time.tribe-events-pro-photo__event-date-tag-datetime"
    );
    const eventDate = dateTag.attr("datetime") || null;

    const startTimeEl = $el.find(
      ".tribe-events-pro-photo__event-datetime time"
    ).first();
    const startTime = parseTime24(startTimeEl.attr("datetime"));

    const price = $el.find(".tribe-events-c-small-cta__price").text().trim() || null;

    if (title && eventDate && eventDate >= today) {
      events.push({
        venue: "cliff_bells",
        title,
        description: price,
        event_date: eventDate,
        start_time: startTime,
        source_url: eventLink,
        venue_url: SHOWS_URL,
      });
    }
  });

  console.log(`[Cliff Bell's] Scraped ${events.length} upcoming events`);
  return events;
}
