import { useCallback, useEffect, useState } from "react";

import { profileHiddenVenuesKey } from "@/lib/profiles";

function storageKey(festivalId: string, profileId: string) {
  return profileHiddenVenuesKey(festivalId, profileId);
}

/** Venue IDs to exclude from the schedule list. */
export function useHiddenVenues(
  festivalId: string,
  validVenueIds: string[],
  profileId: string
) {
  const valid = new Set(validVenueIds);

  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(festivalId, profileId));
      if (!raw) {
        setHidden(new Set());
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        setHidden(new Set());
        return;
      }
      const next = new Set<string>();
      for (const id of parsed) {
        if (typeof id === "string" && valid.has(id)) next.add(id);
      }
      setHidden(next);
    } catch {
      setHidden(new Set());
    }
  }, [festivalId, profileId, validVenueIds]);

  const persist = useCallback(
    (next: Set<string>) => {
      try {
        localStorage.setItem(
          storageKey(festivalId, profileId),
          JSON.stringify([...next])
        );
      } catch {
        /* quota */
      }
    },
    [festivalId, profileId]
  );

  const toggleHidden = useCallback(
    (venueId: string) => {
      setHidden((prev) => {
        const n = new Set(prev);
        if (n.has(venueId)) n.delete(venueId);
        else n.add(venueId);
        persist(n);
        return n;
      });
    },
    [persist]
  );

  /** If every venue is shown, hide all; otherwise show all (matches checkbox “all selected” ↔ “none”). */
  const toggleAllVenues = useCallback(() => {
    setHidden((prev) => {
      const allVisible = prev.size === 0;
      const next = allVisible ? new Set(validVenueIds) : new Set<string>();
      persist(next);
      return next;
    });
  }, [persist, validVenueIds]);

  const hideVenuesBulk = useCallback(
    (venueIds: string[]) => {
      const allowed = new Set(validVenueIds);
      setHidden((prev) => {
        const n = new Set(prev);
        for (const id of venueIds) {
          if (allowed.has(id)) n.add(id);
        }
        persist(n);
        return n;
      });
    },
    [persist, validVenueIds]
  );

  const isHidden = useCallback((venueId: string) => hidden.has(venueId), [hidden]);

  return { hidden, toggleHidden, toggleAllVenues, hideVenuesBulk, isHidden };
}
