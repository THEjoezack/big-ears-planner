import { useMemo } from "react";

import type { ProfileEntry } from "@/lib/profiles";
import { profileShowRatingsKey } from "@/lib/profiles";

import type { ShowRating } from "./useShowRatings";

const LEGACY: Record<string, ShowRating> = {
  dislike: "skip",
};

function normalizeRating(v: string | undefined): ShowRating {
  if (v === "like" || v === "love" || v === "skip") return v;
  if (v && v in LEGACY) return LEGACY[v]!;
  return "unset";
}

function readMap(festivalId: string, profileId: string): Record<string, ShowRating> {
  try {
    const raw = localStorage.getItem(profileShowRatingsKey(festivalId, profileId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const next: Record<string, ShowRating> = {};
    for (const [k, v] of Object.entries(parsed)) {
      next[k] = normalizeRating(v);
    }
    return next;
  } catch {
    return {};
  }
}

/**
 * Ratings for every profile except the active one (for read-only friend rows).
 */
export function useFriendRatingsMaps(
  festivalId: string,
  activeProfileId: string,
  profiles: ProfileEntry[]
): Record<string, Record<string, ShowRating>> {
  return useMemo(() => {
    const out: Record<string, Record<string, ShowRating>> = {};
    for (const p of profiles) {
      if (p.id === activeProfileId) continue;
      out[p.id] = readMap(festivalId, p.id);
    }
    return out;
  }, [festivalId, activeProfileId, profiles]);
}
