export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "big-ears-theme";

export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

export function writeThemePreference(p: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, p);
  } catch {
    /* ignore quota */
  }
}

/** Apply theme to `<html>`; call before first paint when possible. */
export function applyThemePreference(p: ThemePreference) {
  const root = document.documentElement;
  if (p === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", p);
  }
}

export function applyStoredThemePreference() {
  applyThemePreference(readThemePreference());
}
