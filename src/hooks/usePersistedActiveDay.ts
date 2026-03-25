import { useCallback, useEffect, useState } from "react";

import { profileActiveDayKey } from "@/lib/profiles";

function storageKey(festivalId: string, profileId: string) {
  return profileActiveDayKey(festivalId, profileId);
}

function readStoredDay(
  festivalId: string,
  profileId: string,
  dayKeys: string[]
): string {
  if (dayKeys.length === 0) return "";
  try {
    const raw = localStorage.getItem(storageKey(festivalId, profileId));
    if (raw && dayKeys.includes(raw)) return raw;
  } catch {
    /* ignore */
  }
  return dayKeys[0]!;
}

export function usePersistedActiveDay(
  festivalId: string,
  dayKeys: string[],
  profileId: string
) {
  const [activeDay, setActiveDayState] = useState(() =>
    readStoredDay(festivalId, profileId, dayKeys)
  );

  useEffect(() => {
    if (dayKeys.length === 0) {
      setActiveDayState("");
      return;
    }
    const stored = readStoredDay(festivalId, profileId, dayKeys);
    setActiveDayState(stored);
  }, [festivalId, profileId, dayKeys]);

  useEffect(() => {
    if (dayKeys.length === 0) {
      setActiveDayState("");
      return;
    }
    if (!dayKeys.includes(activeDay)) {
      const fallback = dayKeys[0]!;
      setActiveDayState(fallback);
      try {
        localStorage.setItem(storageKey(festivalId, profileId), fallback);
      } catch {
        /* ignore quota */
      }
    }
  }, [activeDay, dayKeys, festivalId, profileId]);

  const setActiveDay = useCallback(
    (next: string) => {
      setActiveDayState(next);
      try {
        localStorage.setItem(storageKey(festivalId, profileId), next);
      } catch {
        /* ignore quota */
      }
    },
    [festivalId, profileId]
  );

  return [activeDay, setActiveDay] as const;
}
