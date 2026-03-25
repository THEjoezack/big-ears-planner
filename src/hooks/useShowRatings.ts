import { useCallback, useEffect, useState } from "react";

import { profileShowRatingsKey } from "@/lib/profiles";

export type ShowRating = "unset" | "like" | "love" | "skip";

const LEGACY: Record<string, ShowRating> = {
  dislike: "skip",
};

function normalizeRating(v: string | undefined): ShowRating {
  if (v === "like" || v === "love" || v === "skip") return v;
  if (v && v in LEGACY) return LEGACY[v]!;
  return "unset";
}

function storageKey(festivalId: string, profileId: string) {
  return profileShowRatingsKey(festivalId, profileId);
}

export function useShowRatings(festivalId: string, profileId: string) {
  const [ratings, setRatings] = useState<Record<string, ShowRating>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(festivalId, profileId));
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
  }, [festivalId, profileId]);

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
          localStorage.setItem(
            storageKey(festivalId, profileId),
            JSON.stringify(next)
          );
        } catch {
          /* ignore quota */
        }
        return next;
      });
    },
    [festivalId, profileId]
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
          localStorage.setItem(
            storageKey(festivalId, profileId),
            JSON.stringify(next)
          );
        } catch {
          /* ignore quota */
        }
        return next;
      });
    },
    [festivalId, profileId]
  );

  return { ratings, setRating, setRatingBulk, getRating };
}
