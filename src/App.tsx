import { useCallback, useMemo, useState } from "react";
import { DateTime } from "luxon";

import { useHiddenVenues } from "@/hooks/useHiddenVenues";
import { usePersistedActiveDay } from "@/hooks/usePersistedActiveDay";
import { useShowRatings, type ShowRating } from "@/hooks/useShowRatings";
import {
  buildShowsByDay,
  sortedDayKeys,
  tabLabel,
  type ShowOnDay,
} from "@/lib/scheduleByDay";
import { ExternalLink } from "@/components/ExternalLink";
import { ThemeSettings } from "@/components/ThemeSettings";
import type { ScheduleDoc } from "@/types/schedule";

import scheduleJson from "../data/schedule.json";

const schedule = scheduleJson as ScheduleDoc;

type SortMode = "time" | "favorites";

type Visibility = {
  love: boolean;
  like: boolean;
  unset: boolean;
  skip: boolean;
};

function ratingPriority(r: ShowRating): number {
  switch (r) {
    case "love":
      return 3;
    case "like":
      return 2;
    case "unset":
      return 1;
    case "skip":
      return 0;
    default:
      return 1;
  }
}

function isVisible(r: ShowRating, v: Visibility): boolean {
  switch (r) {
    case "love":
      return v.love;
    case "like":
      return v.like;
    case "unset":
      return v.unset;
    case "skip":
      return v.skip;
    default:
      return true;
  }
}

function compareRows(
  a: ShowOnDay,
  b: ShowOnDay,
  sort: SortMode,
  getRating: (id: string) => ShowRating
): number {
  if (sort === "favorites") {
    const pa = ratingPriority(getRating(a.show.id));
    const pb = ratingPriority(getRating(b.show.id));
    if (pb !== pa) return pb - pa;
  }
  return a.effectiveStart.toMillis() - b.effectiveStart.toMillis();
}

function formatRange(show: ShowOnDay["show"], zone: string): string {
  const s = DateTime.fromISO(show.start, { zone });
  const e = DateTime.fromISO(show.end, { zone });
  if (s.toISODate() === e.toISODate()) {
    return `${s.toFormat("h:mm a")} – ${e.toFormat("h:mm a")}`;
  }
  return `${s.toFormat("ccc LLL d, h:mm a")} – ${e.toFormat("ccc LLL d, h:mm a")}`;
}

export default function App() {
  const zone = schedule.meta.timezone;
  const { getRating, setRating, setRatingBulk } = useShowRatings(
    schedule.meta.festivalId
  );

  const showById = useMemo(() => {
    const m = new Map<string, (typeof schedule.shows)[0]>();
    for (const s of schedule.shows) {
      m.set(s.id, s);
    }
    return m;
  }, []);

  const venuesSorted = useMemo(
    () => [...schedule.venues].sort((a, b) => a.name.localeCompare(b.name)),
    []
  );
  const venueIdsList = useMemo(
    () => venuesSorted.map((v) => v.id),
    [venuesSorted]
  );
  const { hidden, toggleHidden, toggleAllVenues, hideVenuesBulk, isHidden } =
    useHiddenVenues(schedule.meta.festivalId, venueIdsList);

  const allVenuesSelected = hidden.size === 0;

  const byDay = useMemo(
    () => buildShowsByDay(schedule.shows, zone),
    [zone]
  );
  const dayKeys = useMemo(() => sortedDayKeys(byDay), [byDay]);

  const [activeDay, setActiveDay] = usePersistedActiveDay(
    schedule.meta.festivalId,
    dayKeys
  );
  const [sortMode, setSortMode] = useState<SortMode>("time");
  const [visibility, setVisibility] = useState<Visibility>({
    love: true,
    like: true,
    unset: true,
    skip: true,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const rows = useMemo(() => {
    const list = byDay.get(activeDay) ?? [];
    return list
      .filter((row) => !isHidden(row.show.venueId))
      .filter((row) => isVisible(getRating(row.show.id), visibility))
      .sort((a, b) => compareRows(a, b, sortMode, getRating));
  }, [activeDay, byDay, getRating, isHidden, sortMode, visibility]);

  const selectedCount = selectedIds.size;

  const toggleSelected = useCallback((showId: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(showId)) n.delete(showId);
      else n.add(showId);
      return n;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      for (const row of rows) {
        n.add(row.show.id);
      }
      return n;
    });
  }, [rows]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedIdArray = useMemo(() => [...selectedIds], [selectedIds]);

  const applyBulkRating = useCallback(
    (rating: ShowRating) => {
      if (selectedIdArray.length === 0) return;
      setRatingBulk(selectedIdArray, rating);
      clearSelection();
    },
    [clearSelection, selectedIdArray, setRatingBulk]
  );

  const applyBulkHideVenues = useCallback(() => {
    if (selectedIdArray.length === 0) return;
    const venueIds = new Set<string>();
    for (const id of selectedIdArray) {
      const s = showById.get(id);
      if (s) venueIds.add(s.venueId);
    }
    hideVenuesBulk([...venueIds]);
    clearSelection();
  }, [clearSelection, hideVenuesBulk, selectedIdArray, showById]);

  if (dayKeys.length === 0) {
    return (
      <>
        <ThemeSettings />
        <div className="app app--empty">
          <p>No shows in schedule.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <ThemeSettings />
      <div className={`app${selectedCount > 0 ? " app--selecting" : ""}`}>
      <header className="header">
        <h1 className="header__title">{schedule.meta.name}</h1>
        <p className="header__meta">
          {schedule.meta.year} · {zone.replace("_", " ")} ·{" "}
          {schedule.shows.length} shows
          {schedule.meta.descriptionCount != null
            ? ` · ${schedule.meta.descriptionCount} with descriptions`
            : null}
        </p>
      </header>

      <nav className="day-tabs" aria-label="Festival days">
        {dayKeys.map((key) => (
          <button
            key={key}
            type="button"
            className={`day-tabs__btn${key === activeDay ? " is-active" : ""}`}
            onClick={() => setActiveDay(key)}
          >
            {tabLabel(key, zone)}
          </button>
        ))}
      </nav>

      <div className="toolbar">
        <button
          type="button"
          className="toolbar__filters"
          aria-expanded={filtersOpen}
          aria-controls="filters-panel"
          onClick={() => setFiltersOpen((o) => !o)}
        >
          {filtersOpen ? "Hide filters" : "Filters"}
        </button>
      </div>

      {filtersOpen && (
        <section
          id="filters-panel"
          className="filters"
          aria-label="Sort and visibility"
        >
          <div className="filters__row">
            <label className="filters__label">
              Sort
              <select
                className="filters__select"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
              >
                <option value="time">By start time</option>
                <option value="favorites">Favorites first</option>
              </select>
            </label>
            <p className="filters__hint">
              Favorites first orders: ❤️ → 👀 → ? → × (then by time within each
              group).
            </p>
          </div>
          <fieldset className="filters__fieldset">
            <legend>Show ratings</legend>
            <div className="filters__checks">
              {(
                [
                  ["love", "Show love ratings"],
                  ["like", "Show like ratings"],
                  ["unset", "Show unrated performances"],
                  ["skip", "Show skip ratings"],
                ] as const
              ).map(([key, ariaLabel]) => (
                <label
                  key={key}
                  className="filters__check filters__check--rating-symbol"
                >
                  <input
                    type="checkbox"
                    checked={visibility[key]}
                    onChange={(e) =>
                      setVisibility((v) => ({ ...v, [key]: e.target.checked }))
                    }
                    aria-label={ariaLabel}
                  />
                  {key === "love" ? (
                    <span className="filters__rating-emoji" aria-hidden>
                      ❤️
                    </span>
                  ) : key === "like" ? (
                    <span className="filters__rating-emoji" aria-hidden>
                      👀
                    </span>
                  ) : key === "unset" ? (
                    <span
                      className="filters__rating-emoji filters__rating-emoji--unset"
                      aria-hidden
                    >
                      ?
                    </span>
                  ) : (
                    <span
                      className="filters__rating-emoji filters__rating-emoji--skip"
                      aria-hidden
                    >
                      ×
                    </span>
                  )}
                </label>
              ))}
            </div>
            <p className="filters__hint filters__hint--tight">
              Uncheck <strong>×</strong> to hide acts you marked skip. Combine with{" "}
              <strong>Favorites first</strong> to keep ❤️ / 👀 near the top.
            </p>
          </fieldset>
          <fieldset className="filters__fieldset filters__fieldset--venues">
            <legend>Venues</legend>
            <p className="filters__hint filters__hint--tight">
              Uncheck a venue to <strong>filter it out</strong> (hide all shows
              there). Use <strong>Select all</strong> / <strong>Deselect all</strong>{" "}
              to toggle every venue at once. Your choices are saved in this browser.
            </p>
            <div className="filters__venue-actions">
              <button
                type="button"
                className="filters__linkish"
                onClick={toggleAllVenues}
              >
                {allVenuesSelected
                  ? "Deselect all venues"
                  : "Select all venues"}
              </button>
            </div>
            <div className="filters__venues">
              {venuesSorted.map((v) => (
                <label
                  key={v.id}
                  className="filters__check filters__check--venue"
                >
                  <input
                    type="checkbox"
                    checked={!isHidden(v.id)}
                    onChange={() => toggleHidden(v.id)}
                  />
                  {v.name}
                </label>
              ))}
            </div>
          </fieldset>
        </section>
      )}

      <ul className="show-list">
        {rows.map(({ show, effectiveStart }) => {
          const r = getRating(show.id);
          const isSelected = selectedIds.has(show.id);
          return (
            <li
              key={show.id}
              className={`show-card${isSelected ? " is-selected" : ""}${
                r === "love" || r === "like" || r === "skip"
                  ? ` show-card--${r}`
                  : ""
              }`}
            >
              <div className="show-card__pick">
                <input
                  type="checkbox"
                  className="show-card__checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelected(show.id)}
                  aria-label={`Select ${show.title}`}
                />
              </div>
              <div className="show-card__time">
                <span className="show-card__sort-time">
                  {effectiveStart.toFormat("h:mm a")}
                </span>
                <span className="show-card__range">
                  {formatRange(show, zone)}
                </span>
              </div>
              <div className="show-card__body">
                <h2 className="show-card__title">
                  {show.detailUrl ? (
                    <ExternalLink href={show.detailUrl}>
                      {show.title}
                    </ExternalLink>
                  ) : (
                    show.title
                  )}
                </h2>
                <p className="show-card__venue">{show.venueName}</p>
                {show.description?.trim() ? (
                  <details className="show-card__details">
                    <summary className="show-card__summary">Description</summary>
                    <div className="show-card__description">
                      {show.description.trim()}
                    </div>
                  </details>
                ) : null}
              </div>
              <div
                className="show-card__rate"
                role="group"
                aria-label={`Rate ${show.title}`}
              >
                {(
                  [
                    ["skip", "Skip"],
                    ["like", "Like"],
                    ["love", "Love"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`rate-btn rate-btn--${value}${
                      r === value ? " is-active" : ""
                    }`}
                    aria-label={label}
                    onClick={() =>
                      setRating(show.id, r === value ? "unset" : value)
                    }
                  >
                    {value === "skip" ? (
                      <span className="rate-btn__icon rate-btn__icon--skip" aria-hidden>
                        ×
                      </span>
                    ) : value === "like" ? (
                      <span className="rate-btn__icon" aria-hidden>
                        👀
                      </span>
                    ) : (
                      <span className="rate-btn__icon" aria-hidden>
                        ❤️
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      {rows.length === 0 && (
        <p className="empty-day">
          No shows match your filters for this day.
        </p>
      )}

      {selectedCount > 0 && (
        <div className="bulk-bar" role="region" aria-label="Bulk actions">
          <p className="bulk-bar__count">
            {selectedCount} selected
          </p>
          <div className="bulk-bar__actions">
            <button
              type="button"
              className="bulk-bar__btn"
              onClick={selectAllVisible}
            >
              Add visible to selection
            </button>
            <button
              type="button"
              className="bulk-bar__btn"
              onClick={clearSelection}
            >
              Clear selection
            </button>
          </div>
          <div className="bulk-bar__actions bulk-bar__actions--rates">
            <span className="bulk-bar__label">Set rating:</span>
            <button
              type="button"
              className="bulk-bar__btn bulk-bar__btn--love"
              aria-label="Love — apply to selected"
              onClick={() => applyBulkRating("love")}
            >
              <span className="rate-btn__icon" aria-hidden>
                ❤️
              </span>
            </button>
            <button
              type="button"
              className="bulk-bar__btn bulk-bar__btn--like"
              aria-label="Like — apply to selected"
              onClick={() => applyBulkRating("like")}
            >
              <span className="rate-btn__icon" aria-hidden>
                👀
              </span>
            </button>
            <button
              type="button"
              className="bulk-bar__btn bulk-bar__btn--skip"
              aria-label="Skip — apply to selected"
              onClick={() => applyBulkRating("skip")}
            >
              <span
                className="rate-btn__icon rate-btn__icon--skip"
                aria-hidden
              >
                ×
              </span>
            </button>
            <button
              type="button"
              className="bulk-bar__btn"
              onClick={() => applyBulkRating("unset")}
            >
              Clear rating
            </button>
          </div>
          <div className="bulk-bar__actions">
            <button
              type="button"
              className="bulk-bar__btn bulk-bar__btn--danger"
              onClick={applyBulkHideVenues}
            >
              Hide venues for selected
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
