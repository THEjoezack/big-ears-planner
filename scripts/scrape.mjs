#!/usr/bin/env node
/**
 * Scrapes the Big Ears festival lineup list view into data/schedule.json.
 * Convention for times (America/New_York, festival year 2026):
 * - One date block + start/end: end is on the same calendar day unless end <= start
 *   in local clock order (e.g. 9pm–12am → end is midnight the next calendar day).
 * - First + last date blocks + times: start = first day at start time, end = last day at end time.
 *
 * After the list pass, fetches each event detail page and fills `description` (plain text
 * from `.entry.entry--type-event .entry__content`, paragraphs joined with blank lines).
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { load } from "cheerio";
import { DateTime } from "luxon";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "data", "schedule.json");

const SOURCE_URL = "https://bigearsfestival.org/lineup/?view=list";
const SITE_ORIGIN = "https://bigearsfestival.org";
const FESTIVAL_YEAR = 2026;
const ZONE = "America/New_York";
const DESCRIPTION_CONCURRENCY = 4;
const DESCRIPTION_FETCH_MS = 28_000;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; BigEarsPlanner/1.0; +https://github.com/)",
  Accept: "text/html,application/xhtml+xml",
};

function absoluteDetailUrl(url) {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return new URL(u, SITE_ORIGIN).href;
}

function extractDescription(html) {
  const $ = load(html);
  const $c = $(".entry.entry--type-event .entry__content").first();
  if (!$c.length) return "";
  const paragraphs = $c
    .find("p")
    .toArray()
    .map((el) => $(el).text().replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (paragraphs.length) return paragraphs.join("\n\n");
  return $c.text().replace(/\s+/g, " ").trim();
}

async function fetchDescription(absUrl) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), DESCRIPTION_FETCH_MS);
    try {
      const res = await fetch(absUrl, {
        headers: FETCH_HEADERS,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        if (attempt < 2) await new Promise((r) => setTimeout(r, 700));
        continue;
      }
      const html = await res.text();
      const text = extractDescription(html);
      if (text) return text;
    } catch {
      /* timeout, network, parse */
    } finally {
      clearTimeout(timer);
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 700));
  }
  return "";
}

async function attachDescriptions(shows) {
  const n = shows.length;
  if (n === 0) return;
  console.error(`Fetching descriptions for ${n} events (${DESCRIPTION_CONCURRENCY} concurrent)…`);
  let next = 0;
  let done = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= n) return;
      const show = shows[i];
      const url = absoluteDetailUrl(show.detailUrl);
      show.description = url ? await fetchDescription(url) : "";
      done += 1;
      if (done % 25 === 0 || done === n) {
        console.error(`  descriptions ${done}/${n}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(DESCRIPTION_CONCURRENCY, n) }, () => worker())
  );
}

const MONTHS = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

function slugifyVenue(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseDateBlock($, el) {
  const week = $(el).find(".c-event-list__week").first().text().trim();
  const day = parseInt($(el).find(".c-event-list__day").first().text().trim(), 10);
  const monthStr = $(el).find(".c-event-list__month").first().text().trim();
  const month = MONTHS[monthStr];
  if (!month || Number.isNaN(day)) {
    throw new Error(`Bad date block: week=${week} day=${day} month=${monthStr}`);
  }
  const dt = DateTime.fromObject(
    { year: FESTIVAL_YEAR, month, day, hour: 0, minute: 0, second: 0, millisecond: 0 },
    { zone: ZONE }
  );
  if (!dt.isValid) {
    throw new Error(`Invalid date: ${FESTIVAL_YEAR}-${month}-${day}`);
  }
  return dt;
}

function parseClock(timeStr) {
  const s = timeStr.trim().replace(/\u00a0/g, " ");
  const parsed = DateTime.fromFormat(s, "h:mm a", { zone: ZONE });
  if (!parsed.isValid) {
    const p2 = DateTime.fromFormat(s, "h:mm:ss a", { zone: ZONE });
    if (!p2.isValid) {
      throw new Error(`Unparsed time: "${timeStr}"`);
    }
    return { hour: p2.hour, minute: p2.minute };
  }
  return { hour: parsed.hour, minute: parsed.minute };
}

function atClock(dayStart, { hour, minute }) {
  return dayStart.set({ hour, minute, second: 0, millisecond: 0 });
}

function combineStartEnd(dateBlocks, timeStrings) {
  if (timeStrings.length < 2) {
    throw new Error(`Expected 2 times, got ${timeStrings.length}: ${timeStrings}`);
  }
  const t0 = parseClock(timeStrings[0]);
  const t1 = parseClock(timeStrings[1]);

  if (dateBlocks.length === 0) {
    throw new Error("No date blocks");
  }

  if (dateBlocks.length === 1) {
    const day = dateBlocks[0];
    const start = atClock(day, t0);
    let end = atClock(day, t1);
    if (end <= start) {
      end = end.plus({ days: 1 });
    }
    return {
      start,
      end,
      dateKind: "single_day",
    };
  }

  const firstDay = dateBlocks[0];
  const lastDay = dateBlocks[dateBlocks.length - 1];
  const start = atClock(firstDay, t0);
  let end = atClock(lastDay, t1);
  if (lastDay.equals(firstDay) && end <= start) {
    end = end.plus({ days: 1 });
  }
  return {
    start,
    end,
    dateKind: "multi_day_range",
  };
}

async function main() {
  const res = await fetch(SOURCE_URL, {
    headers: FETCH_HEADERS,
  });
  if (!res.ok) {
    console.error(`Fetch failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const html = await res.text();
  const $ = load(html);

  const items = $('h3.c-event-list.c-event-list--lineup');
  if (items.length === 0) {
    console.error("No lineup rows found (selector mismatch).");
    process.exit(1);
  }

  const venueMap = new Map();
  const shows = [];

  items.each((_, h3) => {
    const $h3 = $(h3);
    const postId =
      $h3.attr("data-id")?.trim() ||
      $h3.find("a.c-event-list__wrap").attr("data-id")?.trim();
    if (!postId) {
      throw new Error("Missing post id on row");
    }

    const $link = $h3.find("a.c-event-list__wrap").first();
    const detailUrl = $link.attr("href")?.trim() || null;

    const dateEls = $h3.find(".dates-wrapper .c-event-list__date").toArray();
    const dateBlocks = dateEls.map((el) => parseDateBlock($, el));

    const timeEls = $h3.find(".list-view-time .c-event-list__startime").toArray();
    const timeStrings = timeEls.map((el) => $(el).text());

    const { start, end, dateKind } = combineStartEnd(dateBlocks, timeStrings);

    const $titleBlock = $h3.find(".c-event-list__title").first().clone();
    $titleBlock.find(".event-venue-list-view").remove();
    const title = $titleBlock.text().replace(/\s+/g, " ").trim();

    const venueName = $h3.find(".event-venue-list-view").first().text().trim();
    if (!venueName) {
      throw new Error(`Missing venue for post ${postId}: ${title}`);
    }

    const venueId = slugifyVenue(venueName);
    if (!venueMap.has(venueId)) {
      venueMap.set(venueId, { id: venueId, name: venueName });
    }

    const rawDateLabel = $h3
      .find(".dates-wrapper")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    shows.push({
      id: `be2026-${postId}`,
      wordpressPostId: parseInt(postId, 10),
      title,
      venueId,
      venueName,
      detailUrl,
      start: start.toISO(),
      end: end.toISO(),
      dateKind,
      description: "",
      raw: {
        dateLine: rawDateLabel,
        times: timeStrings.map((t) => t.trim()),
      },
    });
  });

  const seen = new Set();
  for (const s of shows) {
    if (seen.has(s.id)) {
      throw new Error(`Duplicate show id: ${s.id}`);
    }
    seen.add(s.id);
  }

  const venues = [...venueMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  await attachDescriptions(shows);

  const withDesc = shows.filter((s) => s.description && s.description.length > 0)
    .length;
  const scrapedAt = DateTime.now().setZone(ZONE).toISO();

  const doc = {
    meta: {
      festivalId: "big-ears-2026",
      name: "Big Ears",
      year: FESTIVAL_YEAR,
      timezone: ZONE,
      sourceUrl: SOURCE_URL,
      scrapedAt,
      showCount: shows.length,
      venueCount: venues.length,
      descriptionCount: withDesc,
    },
    venues,
    shows,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(doc, null, 2) + "\n", "utf8");
  console.log(
    `Wrote ${shows.length} shows (${withDesc} with descriptions), ${venues.length} venues → ${OUT}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
