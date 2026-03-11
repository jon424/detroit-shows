import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { scrapeTrinosophes } from "./trinosophes.js";
import { scrapeMoondog } from "./moondog.js";

// Load .env from project root when running locally
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

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function upsertEvents(events) {
  if (events.length === 0) return;

  const { error } = await supabase.from("events").upsert(events, {
    onConflict: "venue,title,event_date",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error("Supabase upsert error:", error.message);
    throw error;
  }
}

async function pruneOldEvents() {
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("events")
    .delete()
    .lt("event_date", today);

  if (error) {
    console.error("Prune error:", error.message);
  } else {
    console.log(`Pruned events before ${today}`);
  }
}

async function main() {
  console.log(`Scrape started at ${new Date().toISOString()}`);

  const allEvents = [];

  // Run scrapers and collect results, continuing even if one fails
  try {
    const trinoEvents = await scrapeTrinosophes();
    allEvents.push(...trinoEvents);
  } catch (err) {
    console.error("[Trinosophes] Scraper failed:", err.message);
  }

  try {
    const moondogEvents = await scrapeMoondog();
    allEvents.push(...moondogEvents);
  } catch (err) {
    console.error("[Moondog] Scraper failed:", err.message);
  }

  if (allEvents.length === 0) {
    console.log("No events scraped. Exiting.");
    process.exit(0);
  }

  console.log(`Total events scraped: ${allEvents.length}`);
  await upsertEvents(allEvents);
  console.log("Events upserted to Supabase");

  await pruneOldEvents();
  console.log("Scrape complete");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
