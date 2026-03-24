import { THEME_STORAGE_KEY, applyThemePreference, readThemePreference } from "@/lib/theme";

const EXPORT_VERSION = 1 as const;

export type AppStateExport = {
  v: typeof EXPORT_VERSION;
  exportedAt: string;
  /** Festival id used for schedule-scoped keys in `localStorage`. */
  festivalId: string;
  localStorage: Record<string, string>;
};

function keysForFestival(festivalId: string): string[] {
  return [
    THEME_STORAGE_KEY,
    `${festivalId}-showRatings`,
    `${festivalId}-hiddenVenues`,
    `${festivalId}-activeDay`,
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

/** Base64 (UTF-8) of compact JSON backup payload. */
export function buildAppStateExportBase64(festivalId: string): string {
  const snapshot: Record<string, string> = {};
  for (const key of keysForFestival(festivalId)) {
    const v = window.localStorage.getItem(key);
    if (v !== null) snapshot[key] = v;
  }
  const payload: AppStateExport = {
    v: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    festivalId,
    localStorage: snapshot,
  };
  return utf8ToBase64(JSON.stringify(payload));
}

export type ImportAppStateResult =
  | { ok: true }
  | { ok: false; error: string };

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function applyParsedBackup(
  parsed: unknown,
  festivalId: string
): ImportAppStateResult {
  if (!isRecord(parsed)) {
    return { ok: false, error: "Backup must be a JSON object." };
  }
  if (parsed.v !== EXPORT_VERSION) {
    return { ok: false, error: "Unrecognized backup version." };
  }
  if (!isRecord(parsed.localStorage)) {
    return { ok: false, error: "Missing or invalid localStorage map." };
  }

  for (const key of keysForFestival(festivalId)) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      return { ok: false, error: "Could not update storage." };
    }
  }

  for (const [key, val] of Object.entries(parsed.localStorage)) {
    if (typeof key !== "string" || key === "") continue;
    if (typeof val === "string") {
      try {
        window.localStorage.setItem(key, val);
      } catch {
        return { ok: false, error: "Could not write to storage (quota or blocked)." };
      }
    } else if (val === null) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        return { ok: false, error: "Could not update storage." };
      }
    } else {
      try {
        window.localStorage.setItem(key, JSON.stringify(val));
      } catch {
        return { ok: false, error: "Could not write to storage." };
      }
    }
  }

  applyThemePreference(readThemePreference());
  return { ok: true };
}

/**
 * Decodes Base64 (whitespace stripped), parses JSON, clears known keys for `festivalId`, then applies backup.
 */
export function importAppStateFromBackup(
  encoded: string,
  festivalId: string
): ImportAppStateResult {
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
  return applyParsedBackup(parsed, festivalId);
}
