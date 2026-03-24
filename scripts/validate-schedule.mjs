#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATH = join(__dirname, "..", "data", "schedule.json");

const Venue = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

const Show = z.object({
  id: z.string().regex(/^be2026-\d+$/),
  wordpressPostId: z.number().int().positive(),
  title: z.string().min(1),
  venueId: z.string().min(1),
  venueName: z.string().min(1),
  detailUrl: z.string().url().nullable(),
  start: z.string().min(1),
  end: z.string().min(1),
  dateKind: z.enum(["single_day", "multi_day_range"]),
  description: z.string().optional(),
  raw: z
    .object({
      dateLine: z.string(),
      times: z.array(z.string()),
    })
    .optional(),
});

const Schedule = z.object({
  meta: z.object({
    festivalId: z.string(),
    name: z.string(),
    year: z.number(),
    timezone: z.string(),
    sourceUrl: z.string().url(),
    scrapedAt: z.string(),
    showCount: z.number().int().nonnegative(),
    venueCount: z.number().int().nonnegative(),
    descriptionCount: z.number().int().nonnegative().optional(),
  }),
  venues: z.array(Venue),
  shows: z.array(Show),
});

async function main() {
  let raw;
  try {
    raw = JSON.parse(await readFile(PATH, "utf8"));
  } catch (e) {
    console.error(`Cannot read or parse ${PATH}:`, e.message);
    process.exit(1);
  }

  const parsed = Schedule.safeParse(raw);
  if (!parsed.success) {
    console.error(parsed.error.format());
    process.exit(1);
  }

  const data = parsed.data;
  if (data.meta.showCount !== data.shows.length) {
    console.error(
      `meta.showCount (${data.meta.showCount}) !== shows.length (${data.shows.length})`
    );
    process.exit(1);
  }
  if (data.meta.venueCount !== data.venues.length) {
    console.error(
      `meta.venueCount (${data.meta.venueCount}) !== venues.length (${data.venues.length})`
    );
    process.exit(1);
  }

  const venueIds = new Set(data.venues.map((v) => v.id));
  for (const s of data.shows) {
    if (!venueIds.has(s.venueId)) {
      console.error(`Show ${s.id} references unknown venueId ${s.venueId}`);
      process.exit(1);
    }
  }

  const ids = new Set();
  for (const s of data.shows) {
    if (ids.has(s.id)) {
      console.error(`Duplicate id ${s.id}`);
      process.exit(1);
    }
    ids.add(s.id);
  }

  console.log(
    `OK: ${data.shows.length} shows, ${data.venues.length} venues (${PATH})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
