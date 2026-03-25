import { THEME_STORAGE_KEY } from "@/lib/theme";

export const DEFAULT_PROFILE_ID = "default";

export type ProfileEntry = { id: string; label: string };

const registryKey = (festivalId: string) => `big-ears-profiles-${festivalId}`;
const activeKey = (festivalId: string) => `big-ears-active-profile-${festivalId}`;

const DEFAULT_REGISTRY: ProfileEntry[] = [
  { id: DEFAULT_PROFILE_ID, label: "You" },
];

export function profileShowRatingsKey(festivalId: string, profileId: string) {
  return `${festivalId}-showRatings__${profileId}`;
}

export function profileHiddenVenuesKey(festivalId: string, profileId: string) {
  return `${festivalId}-hiddenVenues__${profileId}`;
}

export function profileActiveDayKey(festivalId: string, profileId: string) {
  return `${festivalId}-activeDay__${profileId}`;
}

/** Legacy keys before profile suffix migration. */
export function legacyShowRatingsKey(festivalId: string) {
  return `${festivalId}-showRatings`;
}

export function legacyHiddenVenuesKey(festivalId: string) {
  return `${festivalId}-hiddenVenues`;
}

export function legacyActiveDayKey(festivalId: string) {
  return `${festivalId}-activeDay`;
}

/**
 * One-time migration: copy unsuffixed keys to `__default`, then remove legacy.
 */
export function migrateLegacyFestivalKeys(festivalId: string): void {
  const moves: [string, string][] = [
    [legacyShowRatingsKey(festivalId), profileShowRatingsKey(festivalId, DEFAULT_PROFILE_ID)],
    [legacyHiddenVenuesKey(festivalId), profileHiddenVenuesKey(festivalId, DEFAULT_PROFILE_ID)],
    [legacyActiveDayKey(festivalId), profileActiveDayKey(festivalId, DEFAULT_PROFILE_ID)],
  ];
  for (const [from, to] of moves) {
    try {
      const v = localStorage.getItem(from);
      if (v === null) continue;
      if (localStorage.getItem(to) === null) {
        localStorage.setItem(to, v);
      }
      localStorage.removeItem(from);
    } catch {
      /* ignore */
    }
  }
}

export function readProfileRegistry(festivalId: string): ProfileEntry[] {
  try {
    const raw = localStorage.getItem(registryKey(festivalId));
    if (!raw) return [...DEFAULT_REGISTRY];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_REGISTRY];
    const out: ProfileEntry[] = [];
    for (const row of parsed) {
      if (
        row &&
        typeof row === "object" &&
        typeof (row as ProfileEntry).id === "string" &&
        typeof (row as ProfileEntry).label === "string"
      ) {
        out.push({ id: (row as ProfileEntry).id, label: (row as ProfileEntry).label });
      }
    }
    if (!out.some((p) => p.id === DEFAULT_PROFILE_ID)) {
      out.unshift({ id: DEFAULT_PROFILE_ID, label: "You" });
    }
    return out;
  } catch {
    return [...DEFAULT_REGISTRY];
  }
}

export function writeProfileRegistry(festivalId: string, profiles: ProfileEntry[]): void {
  try {
    localStorage.setItem(registryKey(festivalId), JSON.stringify(profiles));
  } catch {
    /* quota */
  }
}

export function readActiveProfileId(festivalId: string): string {
  try {
    const v = localStorage.getItem(activeKey(festivalId));
    if (v && v.length > 0) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_PROFILE_ID;
}

export function writeActiveProfileId(festivalId: string, profileId: string): void {
  try {
    localStorage.setItem(activeKey(festivalId), profileId);
  } catch {
    /* ignore */
  }
}

export function ensureProfileRegistry(festivalId: string): ProfileEntry[] {
  migrateLegacyFestivalKeys(festivalId);
  const list = readProfileRegistry(festivalId);
  writeProfileRegistry(festivalId, list);
  const active = readActiveProfileId(festivalId);
  if (!list.some((p) => p.id === active)) {
    writeActiveProfileId(festivalId, DEFAULT_PROFILE_ID);
  }
  return readProfileRegistry(festivalId);
}

export function slugifyFriendBase(label: string): string {
  const s = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s.slice(0, 36) : "friend";
}

export function allocateFriendProfileId(
  label: string,
  existingIds: Set<string>
): string {
  const base = `friend-${slugifyFriendBase(label)}`;
  if (!existingIds.has(base)) return base;
  let n = 2;
  for (;;) {
    const id = `${base}-${n}`;
    if (!existingIds.has(id)) return id;
    n++;
  }
}

export function otherProfiles(
  profiles: ProfileEntry[],
  activeProfileId: string
): ProfileEntry[] {
  return profiles.filter((p) => p.id !== activeProfileId);
}

/** Remove all festival-scoped keys for one profile (not theme). */
export function clearProfileFestivalStorage(
  festivalId: string,
  profileId: string
): void {
  const keys = [
    profileShowRatingsKey(festivalId, profileId),
    profileHiddenVenuesKey(festivalId, profileId),
    profileActiveDayKey(festivalId, profileId),
  ];
  for (const k of keys) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}

/** Delete every profile except `default`; clear their storage; fix active id. */
export function deleteAllFriendProfiles(festivalId: string): { removed: number } {
  const profiles = readProfileRegistry(festivalId);
  const toRemove = profiles.filter((p) => p.id !== DEFAULT_PROFILE_ID);
  for (const p of toRemove) {
    clearProfileFestivalStorage(festivalId, p.id);
  }
  writeProfileRegistry(festivalId, profiles.filter((p) => p.id === DEFAULT_PROFILE_ID));
  const active = readActiveProfileId(festivalId);
  if (active !== DEFAULT_PROFILE_ID) {
    writeActiveProfileId(festivalId, DEFAULT_PROFILE_ID);
  }
  return { removed: toRemove.length };
}

/** Clear active profile festival data + theme (friends unchanged). */
export function clearActiveProfileDataAndTheme(
  festivalId: string,
  activeProfileId: string
): void {
  clearProfileFestivalStorage(festivalId, activeProfileId);
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function addProfileToRegistry(
  festivalId: string,
  id: string,
  label: string
): ProfileEntry[] {
  const profiles = readProfileRegistry(festivalId);
  if (profiles.some((p) => p.id === id)) return profiles;
  profiles.push({ id, label });
  writeProfileRegistry(festivalId, profiles);
  return profiles;
}
