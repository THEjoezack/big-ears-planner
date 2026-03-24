import { DateTime } from "luxon";

import type { Show } from "@/types/schedule";

export interface ShowOnDay {
  show: Show;
  /** Start instant used for sorting within this calendar day */
  effectiveStart: DateTime;
}

function showOverlapsDay(show: Show, dayStart: DateTime, zone: string): boolean {
  const s = DateTime.fromISO(show.start, { zone });
  const e = DateTime.fromISO(show.end, { zone });
  const d0 = dayStart.startOf("day");
  const d1 = dayStart.endOf("day");
  return s <= d1 && e >= d0;
}

function effectiveStartOnDay(show: Show, dayStart: DateTime, zone: string): DateTime {
  const s = DateTime.fromISO(show.start, { zone });
  const d0 = dayStart.startOf("day");
  return s < d0 ? d0 : s;
}

/** Calendar days (start-of-day in zone) that intersect [show.start, show.end]. */
export function calendarDaysForShow(show: Show, zone: string): DateTime[] {
  const s = DateTime.fromISO(show.start, { zone }).startOf("day");
  const e = DateTime.fromISO(show.end, { zone }).startOf("day");
  const out: DateTime[] = [];
  let d = s;
  while (d <= e) {
    out.push(d);
    d = d.plus({ days: 1 });
  }
  return out;
}

export function buildShowsByDay(shows: Show[], zone: string): Map<string, ShowOnDay[]> {
  const map = new Map<string, ShowOnDay[]>();

  for (const show of shows) {
    for (const day of calendarDaysForShow(show, zone)) {
      if (!showOverlapsDay(show, day, zone)) continue;
      const key = day.toISODate();
      if (!key) continue;
      const effectiveStart = effectiveStartOnDay(show, day, zone);
      const list = map.get(key) ?? [];
      list.push({ show, effectiveStart });
      map.set(key, list);
    }
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
