import LZString from "lz-string";

import { buildAppStateExportPayload } from "@/lib/appStateBackup";

/** Warn if share URL might fail on some platforms (chars, not exact byte limit). */
export const SHARE_URL_WARN_LENGTH = 8000;

function base64ToBase64Url(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBase64(u: string): string {
  let s = u.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return s;
}

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * `0` + base64url(utf8-base64-json) or `1` + base64url(LZString.compressToBase64(json)).
 */
export function encodeShareImportToken(festivalId: string, profileId: string): {
  token: string;
  length: number;
} {
  const json = JSON.stringify(buildAppStateExportPayload(festivalId, profileId));
  const rawB64 = utf8ToBase64(json);
  const rawToken = `0${base64ToBase64Url(rawB64)}`;
  let lzToken = rawToken;
  try {
    const lz = LZString.compressToBase64(json);
    if (lz) {
      const candidate = `1${base64ToBase64Url(lz)}`;
      if (candidate.length < rawToken.length) lzToken = candidate;
    }
  } catch {
    /* keep raw */
  }
  return { token: lzToken, length: lzToken.length };
}

export function decodeShareImportTokenToBase64(
  token: string
): { ok: true; base64: string } | { ok: false; error: string } {
  const t = token.trim();
  if (!t || (t[0] !== "0" && t[0] !== "1")) {
    return { ok: false, error: "Invalid share link payload." };
  }
  const mode = t[0];
  const body = t.slice(1);
  try {
    const b64 = base64UrlToBase64(body);
    if (mode === "0") {
      return { ok: true, base64: b64 };
    }
    const lzDecoded = LZString.decompressFromBase64(b64);
    if (!lzDecoded) {
      return { ok: false, error: "Could not decompress share link." };
    }
    return { ok: true, base64: utf8ToBase64(lzDecoded) };
  } catch {
    return { ok: false, error: "Invalid share link encoding." };
  }
}

export const IMPORT_HASH_PREFIX = "import=";

export function readImportHashFromLocation(): string | null {
  const h = window.location.hash.replace(/^#/, "");
  if (!h.startsWith(IMPORT_HASH_PREFIX)) return null;
  return h.slice(IMPORT_HASH_PREFIX.length) || null;
}

export function stripImportHashFromUrl(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}`);
}
