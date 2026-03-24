import { useCallback, useEffect, useState } from "react";

export type ShowRating = "unset" | "like" | "love" | "skip";

const LEGACY: Record<string, ShowRating> = {
  dislike: "skip",
};

function normalizeRating(v: string | undefined): ShowRating {
  if (v === "like" || v === "love" || v === "skip") return v;
  if (v && v in LEGACY) return LEGACY[v]!;
  return "unset";
}

function storageKey(festivalId: string) {
  return `${festivalId}-showRatings`;
}

export function useShowRatings(festivalId: string) {
  const [ratings, setRatings] = useState<Record<string, ShowRating>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(festivalId));
      if (!raw) {
        setRatings({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, string>;
      const next: Record<string, ShowRating> = {};
      for (const [k, v] of Object.entries(parsed)) {
        next[k] = normalizeRating(v);
      }
      setRatings(next);
    } catch {
      setRatings({});
    }
  }, [festivalId]);

  const setRating = useCallback(
    (showId: string, rating: ShowRating) => {
      setRatings((prev) => {
        const next = { ...prev };
        if (rating === "unset") {
          delete next[showId];
        } else {
          next[showId] = rating;
        }
        try {
          localStorage.setItem(storageKey(festivalId), JSON.stringify(next));
        } catch {
          /* ignore quota */
        }
        return next;
      });
    },
    [festivalId]
  );

  const getRating = useCallback(
    (showId: string): ShowRating => {
      return normalizeRating(ratings[showId]);
    },
    [ratings]
  );

  const setRatingBulk = useCallback(
    (showIds: string[], rating: ShowRating) => {
      setRatings((prev) => {
        const next = { ...prev };
        for (const id of showIds) {
          if (rating === "unset") {
            delete next[id];
          } else {
            next[id] = rating;
          }
        }
        try {
          localStorage.setItem(storageKey(festivalId), JSON.stringify(next));
        } catch {
          /* ignore quota */
        }
        return next;
      });
    },
    [festivalId]
  );

  return { ratings, setRating, setRatingBulk, getRating };
}
