import { useCallback, useRef, type TouchEvent } from "react";

/**
 * Horizontal swipe on touch surfaces: swipe left → next day, swipe right → previous.
 */
export function useSwipeChangeDay(
  dayKeys: readonly string[],
  activeDay: string,
  setActiveDay: (key: string) => void
) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start || e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) < 52) return;
      if (Math.abs(dy) > Math.abs(dx) * 0.72) return;
      const i = dayKeys.indexOf(activeDay);
      if (i < 0) return;
      if (dx < 0 && i < dayKeys.length - 1) {
        setActiveDay(dayKeys[i + 1]!);
      } else if (dx > 0 && i > 0) {
        setActiveDay(dayKeys[i - 1]!);
      }
    },
    [activeDay, dayKeys, setActiveDay]
  );

  return { onTouchStart, onTouchEnd };
}
