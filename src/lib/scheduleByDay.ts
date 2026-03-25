import { DateTime } from "luxon";

import type { Show } from "@/types/schedule";

export interface ShowOnDay {
  show: Show;
  /** Show start in zone; used for sorting within the day list */
  effectiveStart: DateTime;
}

/** One entry per show, keyed by the calendar day the performance starts (in `zone`). */
export function buildShowsByDay(shows: Show[], zone: string): Map<string, ShowOnDay[]> {
  const map = new Map<string, ShowOnDay[]>();

  for (const show of shows) {
    const effectiveStart = DateTime.fromISO(show.start, { zone });
    const key = effectiveStart.startOf("day").toISODate();
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push({ show, effectiveStart });
    map.set(key, list);
  }

  for (const [, list] of map) {
    list.sort((a, b) => a.effectiveStart.toMillis() - b.effectiveStart.toMillis());
  }

  return map;
}

export function sortedDayKeys(map: Map<string, ShowOnDay[]>): string[] {
  return [...map.keys()].sort();
}

export function tabLabel(isoDate: string, zone: string): string {
  const d = DateTime.fromISO(isoDate, { zone });
  return d.toFormat("ccc LLL d");
}

export function formatShowRange(show: Show, zone: string): string {
  const s = DateTime.fromISO(show.start, { zone });
  const e = DateTime.fromISO(show.end, { zone });
  if (s.toISODate() === e.toISODate()) {
    return `${s.toFormat("h:mm a")} – ${e.toFormat("h:mm a")}`;
  }
  return `${s.toFormat("ccc LLL d, h:mm a")} – ${e.toFormat("ccc LLL d, h:mm a")}`;
}
