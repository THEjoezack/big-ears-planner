import { useCallback, useEffect, useState } from "react";

import { useProfileContext } from "@/context/ProfileContext";
import {
  applyParsedBackupPayload,
  type AppStateExport,
} from "@/lib/appStateBackup";
import {
  addProfileToRegistry,
  allocateFriendProfileId,
  readProfileRegistry,
} from "@/lib/profiles";
import { stripImportHashFromUrl } from "@/lib/shareImportCodec";

type Props = {
  payload: AppStateExport;
  currentFestivalId: string;
  onDone: () => void;
};

export function ImportChooserModal({
  payload,
  currentFestivalId,
  onDone,
}: Props) {
  const { activeProfileId, refreshProfiles, friendProfiles } =
    useProfileContext();

  const [friendTargetId, setFriendTargetId] = useState(
    () => friendProfiles[0]?.id ?? ""
  );
  const [newFriendName, setNewFriendName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mismatch = payload.festivalId !== currentFestivalId;

  useEffect(() => {
    if (friendProfiles.some((p) => p.id === friendTargetId)) return;
    setFriendTargetId(friendProfiles[0]?.id ?? "");
  }, [friendProfiles, friendTargetId]);

  const close = useCallback(() => {
    stripImportHashFromUrl();
    onDone();
  }, [onDone]);

  const overwrite = useCallback(() => {
    setError(null);
    const extra =
      mismatch &&
      !window.confirm(
        `This backup is for festival “${payload.festivalId}”, but you are viewing “${currentFestivalId}”. Importing may not match this schedule’s acts. Continue?`
      );
    if (extra) return;
    if (
      !window.confirm(
        "Replace your ratings, hidden venues, and active day for this festival, and apply the backup theme?"
      )
    ) {
      return;
    }
    const result = applyParsedBackupPayload(payload, currentFestivalId, {
      targetProfileId: activeProfileId,
      skipTheme: false,
      clearTargetFirst: true,
      allowFestivalMismatch: mismatch,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    stripImportHashFromUrl();
    window.location.reload();
  }, [
    mismatch,
    payload,
    currentFestivalId,
    activeProfileId,
  ]);

  const saveToFriend = useCallback(() => {
    setError(null);
    const id = friendTargetId;
    if (!id) {
      setError("Pick a friend profile.");
      return;
    }
    const extra =
      mismatch &&
      !window.confirm(
        `This backup is for festival “${payload.festivalId}”, but you are viewing “${currentFestivalId}”. Continue?`
      );
    if (extra) return;
    if (
      !window.confirm(
        `Overwrite saved data for this friend profile with the imported backup?`
      )
    ) {
      return;
    }
    const result = applyParsedBackupPayload(payload, currentFestivalId, {
      targetProfileId: id,
      skipTheme: true,
      clearTargetFirst: true,
      allowFestivalMismatch: mismatch,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    refreshProfiles();
    stripImportHashFromUrl();
    window.location.reload();
  }, [
    mismatch,
    payload,
    currentFestivalId,
    friendTargetId,
    refreshProfiles,
  ]);

  const createFriend = useCallback(() => {
    setError(null);
    const label = newFriendName.trim();
    if (!label) {
      setError("Enter a name for the new friend profile.");
      return;
    }
    const existing = readProfileRegistry(currentFestivalId);
    const ids = new Set(existing.map((p) => p.id));
    const id = allocateFriendProfileId(label, ids);
    if (existing.some((p) => p.label.toLowerCase() === label.toLowerCase())) {
      setError("A profile with a similar name already exists.");
      return;
    }
    const extra =
      mismatch &&
      !window.confirm(
        `This backup is for festival “${payload.festivalId}”, but you are viewing “${currentFestivalId}”. Continue?`
      );
    if (extra) return;
    addProfileToRegistry(currentFestivalId, id, label);
    refreshProfiles();
    const result = applyParsedBackupPayload(payload, currentFestivalId, {
      targetProfileId: id,
      skipTheme: true,
      clearTargetFirst: true,
      allowFestivalMismatch: mismatch,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    stripImportHashFromUrl();
    window.location.reload();
  }, [
    mismatch,
    newFriendName,
    payload,
    currentFestivalId,
    refreshProfiles,
  ]);

  return (
    <div className="import-modal-overlay" role="presentation">
      <div
        className="import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
      >
        <h2 id="import-modal-title" className="import-modal__title">
          Import shared schedule
        </h2>
        {mismatch ? (
          <p className="import-modal__warn" role="alert">
            This link is for festival <strong>{payload.festivalId}</strong>, but
            this app is open on <strong>{currentFestivalId}</strong>. You can
            still import into this festival’s storage if you understand the
            IDs may not line up.
          </p>
        ) : null}
        {error ? (
          <p className="import-modal__error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="import-modal__hint">
          Choose how to save this data. Your other profiles are not changed
          unless you pick a friend target.
        </p>
        <div className="import-modal__actions">
          <button type="button" className="import-modal__btn" onClick={overwrite}>
            Overwrite my data
          </button>
        </div>
        {friendProfiles.length > 0 ? (
          <div className="import-modal__block">
            <label className="import-modal__label" htmlFor="import-friend-select">
              Save as existing friend
            </label>
            <select
              id="import-friend-select"
              className="import-modal__select"
              value={friendTargetId}
              onChange={(e) => setFriendTargetId(e.target.value)}
            >
              {friendProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="import-modal__btn import-modal__btn--secondary"
              onClick={saveToFriend}
            >
              Import into selected friend
            </button>
          </div>
        ) : null}
        <div className="import-modal__block">
          <label className="import-modal__label" htmlFor="import-new-friend">
            New friend name
          </label>
          <input
            id="import-new-friend"
            type="text"
            className="import-modal__input"
            value={newFriendName}
            onChange={(e) => setNewFriendName(e.target.value)}
            placeholder="e.g. Alex"
            autoComplete="off"
          />
          <button
            type="button"
            className="import-modal__btn import-modal__btn--secondary"
            onClick={createFriend}
          >
            Create friend & import
          </button>
        </div>
        <div className="import-modal__footer">
          <button type="button" className="import-modal__linkish" onClick={close}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
