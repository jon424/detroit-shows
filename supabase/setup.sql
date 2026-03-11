-- Detroit Shows: Supabase schema setup
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)

CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venue TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE,
  start_time TIME,
  source_url TEXT,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(venue, title, event_date)
);

CREATE INDEX idx_events_date ON events (event_date);
CREATE INDEX idx_events_venue ON events (venue);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON events
  FOR SELECT
  TO anon
  USING (true);
