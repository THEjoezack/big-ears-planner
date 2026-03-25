import { useCallback, useEffect, useId, useState } from "react";

import { useProfileContext } from "@/context/ProfileContext";
import {
  buildAppStateExportBase64,
  importAppStateFromBackup,
} from "@/lib/appStateBackup";
import {
  clearActiveProfileDataAndTheme,
  DEFAULT_PROFILE_ID,
  deleteAllFriendProfiles,
  readProfileRegistry,
} from "@/lib/profiles";
import { encodeShareImportToken } from "@/lib/shareImportCodec";
import { applyThemePreference, readThemePreference } from "@/lib/theme";
import { useThemePreference } from "@/hooks/useThemePreference";
import { useShareScheduleLink } from "@/hooks/useShareScheduleLink";
import type { ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

type Props = { festivalId: string };

/** Full-page settings: theme, profile, share, backup, and data deletion. */
export function SettingsPanel({ festivalId }: Props) {
  const {
    profiles,
    activeProfileId,
    setActiveProfileId,
    refreshProfiles,
  } = useProfileContext();
  const { preference, setPreference } = useThemePreference();
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const { shareHint, shareOrCopy, copyShareUrl } = useShareScheduleLink(
    festivalId,
    activeProfileId
  );
  const [deleteDialog, setDeleteDialog] = useState<null | "friends" | "mine">(
    null
  );
  const exportFieldId = useId();
  const importFieldId = useId();
  const profileSelectId = useId();

  useEffect(() => {
    setExportText(buildAppStateExportBase64(festivalId, activeProfileId));
  }, [festivalId, activeProfileId, preference]);

  const applyImport = useCallback(() => {
    setImportError(null);
    if (
      !window.confirm(
        "Replace saved ratings, hidden venues, active day, and theme for your current profile on this device with the pasted backup?"
      )
    ) {
      return;
    }
    const result = importAppStateFromBackup(
      importText,
      festivalId,
      activeProfileId
    );
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    window.location.reload();
  }, [importText, festivalId, activeProfileId]);

  const friendDeleteCount = readProfileRegistry(festivalId).filter(
    (p) => p.id !== DEFAULT_PROFILE_ID
  ).length;

  const requestDeleteFriends = useCallback(() => {
    const list = readProfileRegistry(festivalId);
    const n = list.filter((p) => p.id !== DEFAULT_PROFILE_ID).length;
    if (n === 0) {
      window.alert("There are no friend profiles to remove.");
      return;
    }
    setDeleteDialog("friends");
  }, [festivalId]);

  const confirmDeleteFriends = useCallback(() => {
    setDeleteDialog(null);
    deleteAllFriendProfiles(festivalId);
    refreshProfiles();
    window.location.reload();
  }, [festivalId, refreshProfiles]);

  const requestDeleteMine = useCallback(() => {
    setDeleteDialog("mine");
  }, []);

  const confirmDeleteMine = useCallback(() => {
    setDeleteDialog(null);
    clearActiveProfileDataAndTheme(festivalId, activeProfileId);
    applyThemePreference(readThemePreference());
    window.location.reload();
  }, [festivalId, activeProfileId]);

  const shareUrlDisplay = (() => {
    const { token } = encodeShareImportToken(festivalId, activeProfileId);
    return `${window.location.origin}${window.location.pathname}#import=${token}`;
  })();

  return (
    <section className="settings-page" aria-label="Settings">
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

      <div className="settings-page__profile">
        <p className="theme-settings__heading">Editing as</p>
        <label className="theme-settings__field-label" htmlFor={profileSelectId}>
          Active profile
        </label>
        <select
          id={profileSelectId}
          className="import-modal__select"
          value={activeProfileId}
          onChange={(e) => setActiveProfileId(e.target.value)}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="settings-page__share-hint">
          Ratings and venue filters you change apply to this profile. Other
          profiles appear as read-only lines on each act.
        </p>
      </div>

      <div className="settings-page__share">
        <p className="theme-settings__heading">Share link</p>
        <p className="settings-page__share-hint">
          Creates a link with this profile’s data (and theme). Opening it on
          another device shows import options.
        </p>
        <div className="settings-page__share-actions">
          <button
            type="button"
            className="theme-settings__import-btn"
            onClick={() => void shareOrCopy()}
          >
            Share…
          </button>
          <button
            type="button"
            className="theme-settings__import-btn"
            onClick={copyShareUrl}
          >
            Copy link
          </button>
        </div>
        {shareHint ? (
          <p className="settings-page__share-hint" role="status">
            {shareHint}
          </p>
        ) : null}
        <label className="theme-settings__field-label" htmlFor="share-url-ro">
          Current share URL (read-only)
        </label>
        <textarea
          id="share-url-ro"
          className="theme-settings__textarea"
          readOnly
          rows={3}
          value={shareUrlDisplay}
          aria-readonly="true"
          onFocus={(e) => e.target.select()}
        />
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

      <div className="settings-page__danger">
        <p className="theme-settings__heading">Data</p>
        <p className="settings-page__danger-note">
          These actions require confirmation. They only affect this browser.
        </p>
        <button
          type="button"
          className="settings-page__danger-btn settings-page__danger-btn--secondary"
          onClick={requestDeleteFriends}
        >
          Delete all friends’ data
        </button>
        <button
          type="button"
          className="settings-page__danger-btn"
          onClick={requestDeleteMine}
        >
          Delete my schedule data
        </button>
      </div>

      {deleteDialog ? (
        <div className="import-modal-overlay" role="presentation">
          <div
            className="import-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
            aria-describedby="delete-confirm-desc"
          >
            <h2 id="delete-confirm-title" className="import-modal__title">
              {deleteDialog === "friends"
                ? "Delete all friends’ data?"
                : "Delete your schedule data?"}
            </h2>
            <p id="delete-confirm-desc" className="import-modal__hint">
              {deleteDialog === "friends" ? (
                <>
                  <strong>{friendDeleteCount} friend profile(s)</strong> will be
                  removed and their saved ratings and filters for this festival
                  deleted. Your own profile is unchanged.
                </>
              ) : (
                <>
                  This removes your current profile’s ratings, hidden venues,
                  and active day for this festival, and resets{" "}
                  <strong>theme</strong> to the system default. Friend profiles
                  are not removed.
                </>
              )}
            </p>
            <div className="settings-delete-confirm__actions">
              <button
                type="button"
                className="import-modal__btn import-modal__btn--secondary"
                onClick={() => setDeleteDialog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="settings-delete-confirm__delete-btn"
                onClick={
                  deleteDialog === "friends"
                    ? confirmDeleteFriends
                    : confirmDeleteMine
                }
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
