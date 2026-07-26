import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL) {
  try {
    const envPath = new URL("../.env", import.meta.url);
    for (const line of readFileSync(envPath, "utf-8").split("\n")) {
      const [key, ...rest] = line.split("=");
      if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
    }
  } catch {}
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUTTONDOWN_API_KEY = process.env.BUTTONDOWN_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}
if (!BUTTONDOWN_API_KEY) {
  console.error("Missing BUTTONDOWN_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const VENUE_LABELS = {
  trinosophes: "Trinosophes",
  moondog: "Moondog Cafe",
};

function venueLabel(venue) {
  return VENUE_LABELS[venue] || venue;
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const month = date.toLocaleDateString("en-US", { month: "long" });
  return `${weekday}, ${month} ${d}`;
}

function formatTime(time24) {
  if (!time24) return null;
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hour12}${period}` : `${hour12}:${String(m).padStart(2, "0")}${period}`;
}

async function getWeekEvents() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() + ((1 - today.getDay() + 7) % 7 || 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startDate = monday.toISOString().slice(0, 10);
  const endDate = sunday.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .gte("event_date", startDate)
    .lte("event_date", endDate)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(`Supabase query error: ${error.message}`);
  }

  return { events: data || [], startDate, endDate };
}

function buildEmailBody(events) {
  if (events.length === 0) {
    return "No events listed for this week. Check back next Sunday!\n\n—\n[Detroit Shows](https://detroitshows.org)";
  }

  const grouped = new Map();
  for (const ev of events) {
    const key = ev.event_date;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(ev);
  }

  let body = "";

  for (const [date, dayEvents] of grouped) {
    body += `### ${formatDate(date)}\n\n`;
    for (const ev of dayEvents) {
      const time = formatTime(ev.start_time);
      const venue = venueLabel(ev.venue);
      let line = `**${ev.title}**`;
      if (time) line += ` — ${time}`;
      line += ` @ ${venue}`;
      if (ev.description) line += ` _(${ev.description})_`;
      body += `${line}\n\n`;
    }
  }

  body += "—\n\n";
  body += "Know of a show we're missing? [Submit it here.](https://detroitshows.org/contact.html)\n\n";
  body += "[View all events on Detroit Shows](https://detroitshows.org)\n";

  return body;
}

function buildSubject(startDate) {
  const [y, m, d] = startDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  return `Detroit Shows — Week of ${month} ${d}`;
}

async function sendNewsletter(subject, body) {
  // Create the email
  const createRes = await fetch("https://api.buttondown.com/v1/emails", {
    method: "POST",
    headers: {
      Authorization: `Token ${BUTTONDOWN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ subject, body, status: "draft" }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Buttondown create failed (${createRes.status}): ${err}`);
  }

  const email = await createRes.json();
  console.log(`Draft created: ${email.id}`);

  // Publish immediately
  const publishRes = await fetch(
    `https://api.buttondown.com/v1/emails/${email.id}/publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${BUTTONDOWN_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }
  );

  if (!publishRes.ok) {
    const err = await publishRes.text();
    throw new Error(`Buttondown publish failed (${publishRes.status}): ${err}`);
  }

  console.log("Newsletter published successfully");
}

async function main() {
  console.log(`Newsletter run at ${new Date().toISOString()}`);

  const { events, startDate } = await getWeekEvents();
  console.log(`Found ${events.length} events for the week of ${startDate}`);

  const subject = buildSubject(startDate);
  const body = buildEmailBody(events);

  if (process.argv.includes("--dry-run")) {
    console.log("\n--- DRY RUN ---");
    console.log(`Subject: ${subject}\n`);
    console.log(body);
    return;
  }

  await sendNewsletter(subject, body);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
