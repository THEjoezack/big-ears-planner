import { THEME_STORAGE_KEY, applyThemePreference, readThemePreference } from "@/lib/theme";
import {
  profileActiveDayKey,
  profileHiddenVenuesKey,
  profileShowRatingsKey,
} from "@/lib/profiles";

export const EXPORT_VERSION = 2 as const;
export const EXPORT_VERSION_LEGACY = 1 as const;

export type AppStateExport = {
  v: typeof EXPORT_VERSION | typeof EXPORT_VERSION_LEGACY;
  exportedAt: string;
  festivalId: string;
  /** Present for v2: profile whose festival keys are included. */
  exportedProfileId?: string;
  localStorage: Record<string, string>;
};

export type FestivalDataSnapshot = {
  showRatings?: string;
  hiddenVenues?: string;
  activeDay?: string;
  theme?: string;
};

export function storageKeysForProfileExport(
  festivalId: string,
  profileId: string
): string[] {
  return [
    THEME_STORAGE_KEY,
    profileShowRatingsKey(festivalId, profileId),
    profileHiddenVenuesKey(festivalId, profileId),
    profileActiveDayKey(festivalId, profileId),
  ];
}

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function buildAppStateExportPayload(
  festivalId: string,
  profileId: string
): AppStateExport {
  const snapshot: Record<string, string> = {};
  for (const key of storageKeysForProfileExport(festivalId, profileId)) {
    const v = window.localStorage.getItem(key);
    if (v !== null) snapshot[key] = v;
  }
  return {
    v: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    festivalId,
    exportedProfileId: profileId,
    localStorage: snapshot,
  };
}

export function buildAppStateExportBase64(
  festivalId: string,
  profileId: string
): string {
  return utf8ToBase64(JSON.stringify(buildAppStateExportPayload(festivalId, profileId)));
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function normalizeLocalStorageMap(
  raw: unknown
): Record<string, string> | null {
  if (!isRecord(raw)) return null;
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (typeof key !== "string" || key === "") continue;
    if (typeof val === "string") out[key] = val;
    else if (val === null) continue;
    else out[key] = JSON.stringify(val);
  }
  return out;
}

/**
 * Extract festival + theme fields from a backup's localStorage map.
 */
export function extractFestivalDataFromExport(
  festivalId: string,
  exportPayload: AppStateExport
): FestivalDataSnapshot | null {
  const ls = exportPayload.localStorage;
  const theme = ls[THEME_STORAGE_KEY];

  const v = exportPayload.v;
  if (v === EXPORT_VERSION && exportPayload.exportedProfileId) {
    const pid = exportPayload.exportedProfileId;
    const sr = ls[profileShowRatingsKey(festivalId, pid)];
    const hv = ls[profileHiddenVenuesKey(festivalId, pid)];
    const ad = ls[profileActiveDayKey(festivalId, pid)];
    if (sr !== undefined || hv !== undefined || ad !== undefined || theme !== undefined) {
      return {
        showRatings: sr,
        hiddenVenues: hv,
        activeDay: ad,
        theme,
      };
    }
  }

  const suffixKeys = Object.keys(ls).filter((k) =>
    k.startsWith(`${festivalId}-showRatings__`)
  );
  if (suffixKeys.length === 1) {
    const suffix = suffixKeys[0]!.slice(`${festivalId}-showRatings__`.length);
    return {
      showRatings: ls[profileShowRatingsKey(festivalId, suffix)],
      hiddenVenues: ls[profileHiddenVenuesKey(festivalId, suffix)],
      activeDay: ls[profileActiveDayKey(festivalId, suffix)],
      theme,
    };
  }

  const legacySr = ls[`${festivalId}-showRatings`];
  const legacyHv = ls[`${festivalId}-hiddenVenues`];
  const legacyAd = ls[`${festivalId}-activeDay`];
  if (
    legacySr !== undefined ||
    legacyHv !== undefined ||
    legacyAd !== undefined ||
    theme !== undefined
  ) {
    return {
      showRatings: legacySr,
      hiddenVenues: legacyHv,
      activeDay: legacyAd,
      theme,
    };
  }

  return null;
}

export type ParseBackupResult =
  | { ok: true; payload: AppStateExport }
  | { ok: false; error: string };

export function parseAppStateFromBase64(encoded: string): ParseBackupResult {
  const trimmed = encoded.trim().replace(/\s+/g, "");
  if (!trimmed) {
    return { ok: false, error: "Paste a Base64 backup string." };
  }
  let json: string;
  try {
    json = base64ToUtf8(trimmed);
  } catch {
    return { ok: false, error: "Invalid Base64." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "Decoded backup is not valid JSON." };
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: "Backup must be a JSON object." };
  }
  const v = parsed.v;
  if (v !== EXPORT_VERSION && v !== EXPORT_VERSION_LEGACY) {
    return { ok: false, error: "Unrecognized backup version." };
  }
  const festivalId = parsed.festivalId;
  if (typeof festivalId !== "string" || !festivalId) {
    return { ok: false, error: "Missing or invalid festivalId." };
  }
  const ls = normalizeLocalStorageMap(parsed.localStorage);
  if (!ls) {
    return { ok: false, error: "Missing or invalid localStorage map." };
  }
  const exportedAt =
    typeof parsed.exportedAt === "string"
      ? parsed.exportedAt
      : new Date().toISOString();
  const exportedProfileId =
    typeof parsed.exportedProfileId === "string"
      ? parsed.exportedProfileId
      : undefined;

  const payload: AppStateExport = {
    v: v as typeof EXPORT_VERSION | typeof EXPORT_VERSION_LEGACY,
    exportedAt,
    festivalId,
    exportedProfileId,
    localStorage: ls,
  };
  return { ok: true, payload };
}

export type ImportAppStateResult =
  | { ok: true }
  | { ok: false; error: string };

export type ApplyBackupOptions = {
  /** Keys written under this profile id. */
  targetProfileId: string;
  /** When true, clear theme from snapshot (import-as-friend). */
  skipTheme: boolean;
  /** When true, remove target profile festival keys (+ theme if !skipTheme) before write. */
  clearTargetFirst: boolean;
};

function writeSnapshotToProfile(
  festivalId: string,
  targetProfileId: string,
  data: FestivalDataSnapshot,
  skipTheme: boolean
): ImportAppStateResult {
  try {
    if (data.showRatings !== undefined) {
      localStorage.setItem(
        profileShowRatingsKey(festivalId, targetProfileId),
        data.showRatings
      );
    } else {
      localStorage.removeItem(profileShowRatingsKey(festivalId, targetProfileId));
    }
    if (data.hiddenVenues !== undefined) {
      localStorage.setItem(
        profileHiddenVenuesKey(festivalId, targetProfileId),
        data.hiddenVenues
      );
    } else {
      localStorage.removeItem(profileHiddenVenuesKey(festivalId, targetProfileId));
    }
    if (data.activeDay !== undefined) {
      localStorage.setItem(
        profileActiveDayKey(festivalId, targetProfileId),
        data.activeDay
      );
    } else {
      localStorage.removeItem(profileActiveDayKey(festivalId, targetProfileId));
    }
    if (!skipTheme && data.theme !== undefined) {
      localStorage.setItem(THEME_STORAGE_KEY, data.theme);
    }
  } catch {
    return { ok: false, error: "Could not write to storage (quota or blocked)." };
  }
  applyThemePreference(readThemePreference());
  return { ok: true };
}

export function clearTargetProfileKeys(
  festivalId: string,
  targetProfileId: string,
  includeTheme: boolean
): ImportAppStateResult {
  try {
    localStorage.removeItem(profileShowRatingsKey(festivalId, targetProfileId));
    localStorage.removeItem(profileHiddenVenuesKey(festivalId, targetProfileId));
    localStorage.removeItem(profileActiveDayKey(festivalId, targetProfileId));
    if (includeTheme) {
      localStorage.removeItem(THEME_STORAGE_KEY);
    }
  } catch {
    return { ok: false, error: "Could not update storage." };
  }
  return { ok: true };
}

/**
 * Apply decoded backup data to a profile (used by paste import + hash import).
 */
export function applyFestivalSnapshotToProfile(
  festivalId: string,
  snapshot: FestivalDataSnapshot,
  options: ApplyBackupOptions
): ImportAppStateResult {
  const { targetProfileId, skipTheme, clearTargetFirst } = options;
  if (clearTargetFirst) {
    const cleared = clearTargetProfileKeys(
      festivalId,
      targetProfileId,
      !skipTheme
    );
    if (!cleared.ok) return cleared;
  }
  return writeSnapshotToProfile(festivalId, targetProfileId, snapshot, skipTheme);
}

export function applyParsedBackupPayload(
  payload: AppStateExport,
  currentFestivalId: string,
  options: ApplyBackupOptions & { allowFestivalMismatch?: boolean }
): ImportAppStateResult {
  if (
    payload.festivalId !== currentFestivalId &&
    !options.allowFestivalMismatch
  ) {
    return {
      ok: false,
      error: `Backup is for a different festival (${payload.festivalId}).`,
    };
  }
  const snap = extractFestivalDataFromExport(payload.festivalId, payload);
  if (!snap) {
    return { ok: false, error: "Backup has no schedule data for this festival." };
  }
  return applyFestivalSnapshotToProfile(currentFestivalId, snap, options);
}

/**
 * Legacy: full replace using raw keys in payload (v1 style). Prefer applyParsedBackupPayload.
 */
export function importAppStateFromBackup(
  encoded: string,
  festivalId: string,
  activeProfileId: string
): ImportAppStateResult {
  const parsed = parseAppStateFromBase64(encoded);
  if (!parsed.ok) return parsed;
  return applyParsedBackupPayload(parsed.payload, festivalId, {
    targetProfileId: activeProfileId,
    skipTheme: false,
    clearTargetFirst: true,
  });
}
