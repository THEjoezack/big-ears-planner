import { useCallback, useEffect, useId, useState } from "react";

import {
  buildAppStateExportBase64,
  importAppStateFromBackup,
} from "@/lib/appStateBackup";
import { RatingCountsSummary } from "@/components/RatingCountsSummary";
import { useThemePreference } from "@/hooks/useThemePreference";
import type { ThemePreference } from "@/lib/theme";

type RatingCounts = {
  love: number;
  like: number;
  skip: number;
  unset: number;
};

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

type Props = {
  festivalId: string;
  scheduleTitle: string;
  ratingCounts: RatingCounts;
};

/** Full-page settings: title, counts, theme, and backup. */
export function SettingsPanel({
  festivalId,
  scheduleTitle,
  ratingCounts,
}: Props) {
  const { preference, setPreference } = useThemePreference();
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const exportFieldId = useId();
  const importFieldId = useId();

  useEffect(() => {
    setExportText(buildAppStateExportBase64(festivalId));
  }, [festivalId, preference]);

  const applyImport = useCallback(() => {
    setImportError(null);
    if (
      !window.confirm(
        "Replace saved ratings, hidden venues, active day, and theme on this device with the pasted backup?"
      )
    ) {
      return;
    }
    const result = importAppStateFromBackup(importText, festivalId);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    window.location.reload();
  }, [importText, festivalId]);

  return (
    <section className="settings-page" aria-label="Settings">
      <div className="settings-page__brand">
        <h1 className="header__title">{scheduleTitle}</h1>
        <div className="header__rating-wrap" aria-hidden="true">
          <RatingCountsSummary
            counts={ratingCounts}
            className="header__rating-summary"
          />
        </div>
      </div>

      <p className="theme-settings__heading">Theme</p>
      <div className="theme-settings__options" role="radiogroup" aria-label="Color theme">
        {OPTIONS.map(({ value, label }) => (
          <label key={value} className="theme-settings__option">
            <input
              type="radio"
              name="big-ears-theme-page"
              value={value}
              checked={preference === value}
              onChange={() => setPreference(value)}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="settings-page__backup">
        <p className="theme-settings__heading">Backup</p>
        <label className="theme-settings__field-label" htmlFor={exportFieldId}>
          Export (Base64 — copy this)
        </label>
        <textarea
          id={exportFieldId}
          className="theme-settings__textarea"
          readOnly
          rows={6}
          value={exportText}
          aria-readonly="true"
          onFocus={(e) => e.target.select()}
        />
        <label className="theme-settings__field-label" htmlFor={importFieldId}>
          Import (paste Base64 backup)
        </label>
        <textarea
          id={importFieldId}
          className="theme-settings__textarea"
          rows={6}
          value={importText}
          onChange={(e) => {
            setImportText(e.target.value);
            setImportError(null);
          }}
          placeholder='Paste exported Base64, then click "Apply import".'
          spellCheck={false}
          autoComplete="off"
        />
        {importError ? (
          <p className="theme-settings__import-error" role="alert">
            {importError}
          </p>
        ) : null}
        <button
          type="button"
          className="theme-settings__import-btn"
          onClick={applyImport}
        >
          Apply import
        </button>
      </div>
    </section>
  );
}
