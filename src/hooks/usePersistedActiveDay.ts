import { useCallback, useEffect, useState } from "react";

function storageKey(festivalId: string) {
  return `${festivalId}-activeDay`;
}

function readStoredDay(festivalId: string, dayKeys: string[]): string {
  if (dayKeys.length === 0) return "";
  try {
    const raw = localStorage.getItem(storageKey(festivalId));
    if (raw && dayKeys.includes(raw)) return raw;
  } catch {
    /* ignore */
  }
  return dayKeys[0]!;
}

export function usePersistedActiveDay(festivalId: string, dayKeys: string[]) {
  const [activeDay, setActiveDayState] = useState(() =>
    readStoredDay(festivalId, dayKeys)
  );

  useEffect(() => {
    if (dayKeys.length === 0) {
      setActiveDayState("");
      return;
    }
    if (!dayKeys.includes(activeDay)) {
      const fallback = dayKeys[0]!;
      setActiveDayState(fallback);
      try {
        localStorage.setItem(storageKey(festivalId), fallback);
      } catch {
        /* ignore quota */
      }
    }
  }, [activeDay, dayKeys, festivalId]);

  const setActiveDay = useCallback(
    (next: string) => {
      setActiveDayState(next);
      try {
        localStorage.setItem(storageKey(festivalId), next);
      } catch {
        /* ignore quota */
      }
    },
    [festivalId]
  );

  return [activeDay, setActiveDay] as const;
}
