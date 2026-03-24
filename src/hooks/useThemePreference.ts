import { useCallback, useState } from "react";

import {
  type ThemePreference,
  applyThemePreference,
  readThemePreference,
  writeThemePreference,
} from "@/lib/theme";

export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readThemePreference()
  );

  const setPreference = useCallback((next: ThemePreference) => {
    writeThemePreference(next);
    applyThemePreference(next);
    setPreferenceState(next);
  }, []);

  return { preference, setPreference };
}
