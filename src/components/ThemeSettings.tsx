import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  buildAppStateExportBase64,
  importAppStateFromBackup,
} from "@/lib/appStateBackup";
import { useThemePreference } from "@/hooks/useThemePreference";
import type { ThemePreference } from "@/lib/theme";

function SettingsIcon() {
  return (
    <svg
      className="theme-settings__icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

type Props = { festivalId: string };

export function ThemeSettings({ festivalId }: Props) {
  const { preference, setPreference } = useThemePreference();
  const [open, setOpen] = useState(false);
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const panelId = useId();
  const exportFieldId = useId();
  const importFieldId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    setExportText(buildAppStateExportBase64(festivalId));
  }, [open, festivalId, preference]);

  useEffect(() => {
    if (open) setImportError(null);
  }, [open, festivalId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

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
  }, [importText]);

  return (
    <div className="theme-settings" ref={wrapRef}>
      <button
        type="button"
        className="theme-settings__trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <SettingsIcon />
        <span className="theme-settings__sr">Settings</span>
      </button>
      {open ? (
        <div
          id={panelId}
          className="theme-settings__panel"
          role="dialog"
          aria-label="Settings"
        >
          <p className="theme-settings__heading">Theme</p>
          <div className="theme-settings__options" role="radiogroup" aria-label="Color theme">
            {OPTIONS.map(({ value, label }) => (
              <label key={value} className="theme-settings__option">
                <input
                  type="radio"
                  name="big-ears-theme"
                  value={value}
                  checked={preference === value}
                  onChange={() => {
                    setPreference(value);
                  }}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="theme-settings__backup">
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
        </div>
      ) : null}
    </div>
  );
}
