# Big Ears planner (work in progress)

## Milestone 1: festival schedule JSON

Schedule data is **scraped** from the official lineup <a href="https://bigearsfestival.org/lineup/?view=list" target="_blank" rel="noopener noreferrer">list view</a> and written to `data/schedule.json`. The live site is always authoritative if times or listings change.

### Requirements

- Node.js 20+ (uses global `fetch`; matches Netlify config)

### Commands

```bash
npm install
npm run scrape
npm run validate-schedule
```

- **`npm run scrape`** — Fetches the lineup list, then each event’s detail page to pull **plain-text descriptions** (paragraphs from the event body), and overwrites `data/schedule.json`. Expect a few minutes and many HTTP requests. `meta.descriptionCount` is how many events returned non-empty copy.
- **`npm run validate-schedule`** — Validates the JSON shape with Zod; exits non-zero on failure.

### Time handling

All instants are stored as ISO strings in **`America/New_York`**.

- **Single calendar day** in the listing: `start` and `end` use that day unless the end time is not after the start on the same day (e.g. **9:00 pm — 12:00 am** ends at midnight the **next** calendar day).
- **Date range** in the listing (first and last day shown): `start` is the **first** day at the opening time, `end` is the **last** day at the closing time (`dateKind`: `multi_day_range`). Multi-segment or “same slot every day” events are not expanded; the planner UI may refine that later.

### Scraper fragility

The script depends on the site’s HTML structure (`h3.c-event-list--lineup`, etc.). Theme or template updates on <a href="https://bigearsfestival.org" target="_blank" rel="noopener noreferrer">bigearsfestival.org</a> may require selector changes.

## Milestone 2: browse schedule in the browser

Vite + React app reads [`data/schedule.json`](data/schedule.json) (bundled at build time).

### Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # output in dist/
npm run preview  # serve dist/
```

### Behavior

- **Day tabs** — One tab per calendar day (in `America/New_York`) that has at least one show. Multi-day acts appear on every day they overlap.
- **Sort** — **By start time** (chronological), or **Favorites first** (love → like → not set → skip, then by time within each group).
- **Ratings** — Per show: **Skip**, **Like**, **Love** (tap again to clear). Stored in `localStorage` under `big-ears-2026-showRatings`.
- **Visibility** — Checkboxes for each rating tier; uncheck **Skip** (for example) to hide skipped acts. Use **Favorites first** to keep love/like near the top.

## Milestone 3: venue filter, filters toggle, bulk actions

- **Filters** — Sort, rating visibility, and venues are **hidden until you click “Filters”**; click **Hide filters** to collapse again.
- **Venues** — Scrollable list; **uncheck** a venue to hide every show there (all days). **Select all venues** / **Deselect all venues** toggles every checkbox (all visible ↔ all hidden).
- **Multi-select** — Checkbox on each row. Selection is kept when you switch days until you clear it.
- **Bulk bar** (when anything is selected) — **Add visible to selection**, **Clear selection**, **Love / Like / Skip / Clear rating** for all selected, **Hide venues for selected** (hides every venue used by any selected show).
- **Storage** — Hidden venue ids: `localStorage` key `big-ears-2026-hiddenVenues`. Selection is not persisted.

After re-scraping, run `npm run build` again so the embedded schedule updates (dev mode picks up JSON changes on refresh).

## Deploy on Netlify

The repo includes [`netlify.toml`](netlify.toml): **build** `npm run build`, **publish** `dist`, **Node 20**.

### From Git (recommended)

1. Push this project to GitHub (or GitLab / Bitbucket).
2. In [Netlify](https://www.netlify.com/), **Add new site** → **Import an existing project** → connect the repo.
3. Netlify should auto-detect settings from `netlify.toml`. Deploy.

Each deploy runs a fresh `npm run build`, so whatever [`data/schedule.json`](data/schedule.json) is **committed** (or on that branch) gets baked into the bundle. After you run `npm run scrape` locally, **commit** the updated JSON and push to refresh the live schedule.

### Manual deploy

```bash
npm install
npm run build
```

Drag the **`dist`** folder onto [Netlify Drop](https://app.netlify.com/drop) (or use the CLI: `npx netlify deploy --prod --dir=dist`).

### Notes

- Ratings and hidden venues stay in the visitor’s browser (`localStorage`); nothing is sent to Netlify.
- The app is a static SPA; the catch-all redirect in `netlify.toml` sends unknown paths to `index.html` for future client-side routes.
