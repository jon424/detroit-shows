# Detroit Shows

Upcoming experimental & improvised music concerts in Detroit, scraped from venue sites and displayed in one place.

**Sources:** [Trinosophes](https://trinosophes.com/Events) &middot; [Moondog Cafe](https://www.moondogcafedetroit.com/calendar)

## Architecture

| Component | Tech | Cost |
|-----------|------|------|
| Frontend  | Static HTML/CSS/JS | Free (GitHub Pages) |
| Database  | PostgreSQL via Supabase | Free tier |
| Scraper   | Node.js on GitHub Actions | Free (daily cron) |

A GitHub Actions workflow runs daily, scrapes upcoming events from each venue site, and upserts them into a Supabase PostgreSQL database. The static frontend queries Supabase directly via its REST API.

## Setup

### 1. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) (free tier).
2. Create a new project.
3. Open the **SQL Editor** and run the contents of [`supabase/setup.sql`](supabase/setup.sql) to create the `events` table and RLS policy.
4. Note your **Project URL** and **anon (public) key** from Settings > API.

### 2. Configure the frontend

Edit `js/app.js` and replace the placeholder values at the top:

```js
const SUPABASE_URL = "https://your-project-id.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key-here";
```

### 3. Configure GitHub Actions secrets

In your GitHub repo, go to Settings > Secrets and variables > Actions and add:

- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_KEY` — your Supabase **service_role** key (not the anon key)

The service role key is needed by the scraper to write to the database.

### 4. Install scraper dependencies

```bash
cd scraper
npm install
```

This generates a `package-lock.json` which should be committed so GitHub Actions can use `npm ci`.

### 5. Enable GitHub Pages

In your repo's Settings > Pages, set the source to deploy from the **main** branch, root (`/`).

### 6. Run the scraper

The scraper runs automatically every day at 6:00 AM ET via GitHub Actions. You can also trigger it manually from the Actions tab ("Run workflow").

To run locally:

```bash
cd scraper
SUPABASE_URL=https://... SUPABASE_SERVICE_KEY=... node index.js
```

## Local development

Serve the frontend with any static file server:

```bash
npx serve .
```

## Project structure

```
index.html              Static frontend
css/style.css           Styles
js/app.js               Frontend logic (fetches from Supabase)
scraper/
  index.js              Scraper entry point
  trinosophes.js        Trinosophes event parser
  moondog.js            Moondog Cafe event parser (Puppeteer)
  package.json          Scraper dependencies
supabase/
  setup.sql             Database schema & RLS policy
.github/workflows/
  scrape.yml            Daily scrape workflow
```
