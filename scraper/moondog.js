const ICAL_URL =
  "https://calendar.google.com/calendar/ical/587be445113e87e684b05e7b63e2c4fa72e04d923ec6ae367c3839a8d6be7b70%40group.calendar.google.com/public/basic.ics";

function parseIcalDate(value) {
  if (!value) return { date: null, time: null };
  // Format: 20260319T220000Z or 20260319
  const clean = value.replace(/[^0-9TZ]/g, "");
  const y = clean.slice(0, 4);
  const m = clean.slice(4, 6);
  const d = clean.slice(6, 8);
  const date = `${y}-${m}-${d}`;

  if (clean.includes("T")) {
    const hh = clean.slice(9, 11);
    const mm = clean.slice(11, 13);
    // Convert UTC to America/Detroit (ET) — approximate: UTC-4 (EDT) or UTC-5 (EST)
    const utc = new Date(`${y}-${m}-${d}T${hh}:${mm}:00Z`);
    const et = new Date(utc.toLocaleString("en-US", { timeZone: "America/Detroit" }));
    const localDate = `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, "0")}-${String(et.getDate()).padStart(2, "0")}`;
    const localTime = `${String(et.getHours()).padStart(2, "0")}:${String(et.getMinutes()).padStart(2, "0")}`;
    return { date: localDate, time: localTime };
  }

  return { date, time: null };
}

function unescapeIcal(text) {
  return text
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseVEvents(ical) {
  const events = [];
  const blocks = ical.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    const fields = {};

    // Handle folded lines (continuation lines start with space/tab)
    const unfolded = block.replace(/\r?\n[ \t]/g, "");

    for (const line of unfolded.split(/\r?\n/)) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      let key = line.slice(0, colonIdx);
      const value = line.slice(colonIdx + 1);
      // Strip parameters like DTSTART;TZID=America/Detroit
      key = key.split(";")[0];
      fields[key] = value;
    }

    events.push(fields);
  }

  return events;
}

export async function scrapeMoondog() {
  const res = await fetch(ICAL_URL);
  if (!res.ok) throw new Error(`Moondog iCal fetch failed: ${res.status}`);
  const ical = await res.text();

  const vevents = parseVEvents(ical);
  const today = new Date().toISOString().slice(0, 10);

  const events = vevents
    .map((ve) => {
      const { date, time } = parseIcalDate(ve.DTSTART);
      return {
        venue: "moondog",
        title: unescapeIcal(ve.SUMMARY || ""),
        description: ve.DESCRIPTION ? unescapeIcal(ve.DESCRIPTION) : null,
        event_date: date,
        start_time: time,
        source_url: "https://www.moondogcafedetroit.com/calendar",
        venue_url: "https://www.moondogcafedetroit.com/calendar",
      };
    })
    .filter((e) => e.title && e.event_date && e.event_date >= today);

  console.log(`[Moondog] Scraped ${events.length} upcoming events`);
  return events;
}
