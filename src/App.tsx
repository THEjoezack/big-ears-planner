import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DateTime } from "luxon";

import { ImportChooserModal } from "@/components/ImportChooserModal";
import { ProfileProvider, useProfileContext } from "@/context/ProfileContext";
import { useFriendRatingsMaps } from "@/hooks/useFriendRatingsMaps";
import { useHiddenVenues } from "@/hooks/useHiddenVenues";
import { usePersistedActiveDay } from "@/hooks/usePersistedActiveDay";
import { useShowRatings, type ShowRating } from "@/hooks/useShowRatings";
import {
  decodeShareImportTokenToBase64,
  readImportHashFromLocation,
  stripImportHashFromUrl,
} from "@/lib/shareImportCodec";
import { parseAppStateFromBase64, type AppStateExport } from "@/lib/appStateBackup";
import {
  buildShowsByDay,
  sortedDayKeys,
  tabLabel,
  type ShowOnDay,
} from "@/lib/scheduleByDay";
import { FilterTrigger } from "@/components/FilterTrigger";
import { RatingCountsSummary } from "@/components/RatingCountsSummary";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ShowCard } from "@/components/ShowCard";
import { useShareScheduleLink } from "@/hooks/useShareScheduleLink";
import { useSwipeChangeDay } from "@/hooks/useSwipeChangeDay";
import type { ScheduleDoc } from "@/types/schedule";

import scheduleJson from "../data/schedule.json";

const schedule = scheduleJson as ScheduleDoc;

type MainView = "schedule" | "search" | "faves" | "settings";

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

function countRatingsForDay(
  dayKey: string,
  dayMap: Map<string, ShowOnDay[]>,
  getRating: (id: string) => ShowRating,
  venueIsHidden: (venueId: string) => boolean
) {
  const list = dayMap.get(dayKey) ?? [];
  const counts = { love: 0, like: 0, skip: 0, unset: 0 };
  for (const row of list) {
    if (venueIsHidden(row.show.venueId)) continue;
    const r = getRating(row.show.id);
    if (r === "love") counts.love++;
    else if (r === "like") counts.like++;
    else if (r === "skip") counts.skip++;
    else counts.unset++;
  }
  return counts;
}

function AppInner() {
  const zone = schedule.meta.timezone;
  const festivalId = schedule.meta.festivalId;
  const { activeProfileId, profiles } = useProfileContext();
  const favesShare = useShareScheduleLink(festivalId, activeProfileId);
  const { getRating, setRating, setRatingBulk } = useShowRatings(
    festivalId,
    activeProfileId
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
    useHiddenVenues(festivalId, venueIdsList, activeProfileId);

  const allVenuesSelected = hidden.size === 0;

  const byDay = useMemo(() => buildShowsByDay(schedule.shows, zone), [zone]);
  const dayKeys = useMemo(() => sortedDayKeys(byDay), [byDay]);

  const [activeDay, setActiveDay] = usePersistedActiveDay(
    festivalId,
    dayKeys,
    activeProfileId
  );

  const friendRatingsMaps = useFriendRatingsMaps(
    festivalId,
    activeProfileId,
    profiles
  );

  const friendProfilesList = useMemo(
    () => profiles.filter((p) => p.id !== activeProfileId),
    [profiles, activeProfileId]
  );

  const friendLinesByShowId = useMemo(() => {
    const byShow: Record<
      string,
      { label: string; rating: Exclude<ShowRating, "unset"> }[]
    > = {};
    for (const fp of profiles) {
      if (fp.id === activeProfileId) continue;
      const map = friendRatingsMaps[fp.id] ?? {};
      for (const [showId, rating] of Object.entries(map)) {
        if (rating === "unset") continue;
        const list = byShow[showId];
        const row = { label: fp.label, rating };
        if (list) list.push(row);
        else byShow[showId] = [row];
      }
    }
    return byShow;
  }, [profiles, activeProfileId, friendRatingsMaps]);

  const [shareImportPayload, setShareImportPayload] =
    useState<AppStateExport | null>(null);
  const [shareImportError, setShareImportError] = useState<string | null>(null);

  useEffect(() => {
    const token = readImportHashFromLocation();
    if (!token) return;
    const dec = decodeShareImportTokenToBase64(token);
    if (!dec.ok) {
      setShareImportError(dec.error);
      stripImportHashFromUrl();
      return;
    }
    const parsed = parseAppStateFromBase64(dec.base64);
    if (!parsed.ok) {
      setShareImportError(parsed.error);
      stripImportHashFromUrl();
      return;
    }
    stripImportHashFromUrl();
    setShareImportPayload(parsed.payload);
  }, []);
  const [sortMode, setSortMode] = useState<SortMode>("time");
  const [visibility, setVisibility] = useState<Visibility>({
    love: true,
    like: true,
    unset: true,
    skip: true,
  });
  const [friendFilterProfileId, setFriendFilterProfileId] = useState("");
  const [friendVisibility, setFriendVisibility] = useState<Visibility>({
    love: true,
    like: true,
    unset: true,
    skip: true,
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [mainView, setMainView] = useState<MainView>("schedule");
  const [searchQuery, setSearchQuery] = useState("");

  const filtersPanelId = useId();
  const friendFilterSelectId = useId();
  const dayTabsNavRef = useRef<HTMLElement>(null);
  const tabBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const swipeDayHandlers = useSwipeChangeDay(dayKeys, activeDay, setActiveDay);

  useEffect(() => {
    if (
      !friendFilterProfileId ||
      friendProfilesList.some((p) => p.id === friendFilterProfileId)
    ) {
      return;
    }
    setFriendFilterProfileId("");
  }, [friendProfilesList, friendFilterProfileId]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      tabBtnRefs.current.get(activeDay)?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [activeDay]);

  const activeDayRatingCounts = useMemo(
    () =>
      countRatingsForDay(activeDay, byDay, getRating, (vid) => isHidden(vid)),
    [activeDay, byDay, getRating, isHidden]
  );

  const festivalRatingCounts = useMemo(() => {
    const counts = { love: 0, like: 0, skip: 0, unset: 0 };
    for (const show of schedule.shows) {
      if (isHidden(show.venueId)) continue;
      const r = getRating(show.id);
      if (r === "love") counts.love++;
      else if (r === "like") counts.like++;
      else if (r === "skip") counts.skip++;
      else counts.unset++;
    }
    return counts;
  }, [getRating, isHidden]);

  const rows = useMemo(() => {
    const list = byDay.get(activeDay) ?? [];
    const friendMap = friendFilterProfileId
      ? friendRatingsMaps[friendFilterProfileId]
      : null;
    return list
      .filter((row) => !isHidden(row.show.venueId))
      .filter((row) => {
        if (!isVisible(getRating(row.show.id), visibility)) return false;
        if (!friendFilterProfileId || !friendMap) return true;
        const fr: ShowRating = friendMap[row.show.id] ?? "unset";
        return isVisible(fr, friendVisibility);
      })
      .sort((a, b) => compareRows(a, b, sortMode, getRating));
  }, [
    activeDay,
    byDay,
    friendFilterProfileId,
    friendRatingsMaps,
    friendVisibility,
    getRating,
    isHidden,
    sortMode,
    visibility,
  ]);

  const friendFilterLabel =
    friendProfilesList.find((p) => p.id === friendFilterProfileId)?.label ?? "";

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return schedule.shows
      .filter((s) => {
        if (s.title.toLowerCase().includes(q)) return true;
        if ((s.description ?? "").toLowerCase().includes(q)) return true;
        return false;
      })
      .sort((a, b) => {
        const t = a.title.localeCompare(b.title);
        if (t !== 0) return t;
        return (
          DateTime.fromISO(a.start).toMillis() -
          DateTime.fromISO(b.start).toMillis()
        );
      });
  }, [searchQuery]);

  const favesShows = useMemo(() => {
    return schedule.shows
      .filter((s) => {
        if (isHidden(s.venueId)) return false;
        const r = getRating(s.id);
        return r === "love" || r === "like";
      })
      .sort((a, b) => {
        const ma = DateTime.fromISO(a.start).toMillis();
        const mb = DateTime.fromISO(b.start).toMillis();
        if (ma !== mb) return ma - mb;
        return a.title.localeCompare(b.title);
      });
  }, [getRating, isHidden]);

  const favesByDay = useMemo(() => {
    type S = (typeof schedule.shows)[number];
    const map = new Map<string, S[]>();
    for (const show of favesShows) {
      const dayKey = DateTime.fromISO(show.start, { zone })
        .startOf("day")
        .toISODate();
      if (!dayKey) continue;
      const list = map.get(dayKey);
      if (list) list.push(show);
      else map.set(dayKey, [show]);
    }
    const keys = [...map.keys()].sort((a, b) => a.localeCompare(b));
    return keys.map((dayKey) => ({ dayKey, shows: map.get(dayKey)! }));
  }, [favesShows, zone]);

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

  useEffect(() => {
    if (mainView !== "schedule") clearSelection();
  }, [mainView, clearSelection]);

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

  return (
    <>
      <div
        className={`app${selectedCount > 0 && mainView === "schedule" ? " app--selecting" : ""}`}
      >
        <nav
          className="app-main-tabs"
          role="tablist"
          aria-label="App sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mainView === "schedule"}
            className={`app-main-tabs__btn${mainView === "schedule" ? " is-active" : ""}`}
            onClick={() => setMainView("schedule")}
          >
            Schedule
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainView === "search"}
            className={`app-main-tabs__btn${mainView === "search" ? " is-active" : ""}`}
            onClick={() => setMainView("search")}
          >
            Search
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainView === "faves"}
            className={`app-main-tabs__btn${mainView === "faves" ? " is-active" : ""}`}
            onClick={() => setMainView("faves")}
          >
            Faves
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainView === "settings"}
            className={`app-main-tabs__btn${mainView === "settings" ? " is-active" : ""}`}
            onClick={() => setMainView("settings")}
          >
            Settings
          </button>
        </nav>

        {mainView === "schedule" && dayKeys.length > 0 ? (
          <>
            <nav
              ref={dayTabsNavRef}
              className="day-tabs"
              aria-label="Festival days"
            >
              {dayKeys.map((key) => (
                <button
                  key={key}
                  ref={(el) => {
                    if (el) tabBtnRefs.current.set(key, el);
                    else tabBtnRefs.current.delete(key);
                  }}
                  type="button"
                  className={`day-tabs__btn${key === activeDay ? " is-active" : ""}`}
                  onClick={() => setActiveDay(key)}
                >
                  {tabLabel(key, zone)}
                </button>
              ))}
            </nav>

            <div
              className="app__day-swipe"
              role="region"
              aria-label="Schedule — swipe left or right to change day"
              onTouchStart={swipeDayHandlers.onTouchStart}
              onTouchEnd={swipeDayHandlers.onTouchEnd}
            >
              <section
                className="day-section"
                aria-label={`Shows for ${tabLabel(activeDay, zone)}`}
              >
                <div className="day-section__head">
                  <div className="day-section__filter">
                    <FilterTrigger
                      filtersOpen={filtersOpen}
                      onToggle={() => setFiltersOpen((o) => !o)}
                      panelId={filtersPanelId}
                    />
                  </div>
                  <RatingCountsSummary
                    counts={activeDayRatingCounts}
                    className="day-section__rating-summary"
                  />
                </div>
              </section>

              {filtersOpen && (
                <section
                  id={filtersPanelId}
                  className="filters"
                  aria-label="Sort and visibility"
                >
                  <div className="filters__row">
                    <label className="filters__label">
                      Sort
                      <select
                        className="filters__select"
                        value={sortMode}
                        onChange={(e) =>
                          setSortMode(e.target.value as SortMode)
                        }
                      >
                        <option value="time">By start time</option>
                        <option value="favorites">Favorites first</option>
                      </select>
                    </label>
                    <p className="filters__hint">
                      Favorites first orders: ❤️ → 👀 → ? → × (then by time
                      within each group).
                    </p>
                  </div>
                  <fieldset className="filters__fieldset">
                    <legend>My Ratings</legend>
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
                              setVisibility((v) => ({
                                ...v,
                                [key]: e.target.checked,
                              }))
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
                      Uncheck <strong>×</strong> to hide acts you marked skip.
                      Combine with <strong>Favorites first</strong> to keep ❤️ /
                      👀 near the top.
                    </p>
                  </fieldset>
                  {friendProfilesList.length > 0 ? (
                    <fieldset className="filters__fieldset">
                      <legend>Friend&apos;s Ratings</legend>
                      <p className="filters__hint filters__hint--tight">
                        Pick a friend, then choose which of their ratings still
                        appear. Acts are hidden if they fail your filters or the
                        selected friend&apos;s filters.
                      </p>
                      <label
                        className="filters__label filters__label--friend"
                        htmlFor={friendFilterSelectId}
                      >
                        Friend
                        <select
                          id={friendFilterSelectId}
                          className="filters__select"
                          value={friendFilterProfileId}
                          onChange={(e) =>
                            setFriendFilterProfileId(e.target.value)
                          }
                        >
                          <option value="">None (don&apos;t filter)</option>
                          {friendProfilesList.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="filters__checks">
                        {(
                          [
                            ["love", "loved"],
                            ["like", "liked"],
                            ["unset", "unrated"],
                            ["skip", "skipped"],
                          ] as const
                        ).map(([key, word]) => (
                          <label
                            key={key}
                            className="filters__check filters__check--rating-symbol"
                          >
                            <input
                              type="checkbox"
                              disabled={!friendFilterProfileId}
                              checked={friendVisibility[key]}
                              onChange={(e) =>
                                setFriendVisibility((v) => ({
                                  ...v,
                                  [key]: e.target.checked,
                                }))
                              }
                              aria-label={
                                friendFilterProfileId
                                  ? `Show acts ${friendFilterLabel} ${word}`
                                  : `Select a friend to filter by their ${word} acts`
                              }
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
                    </fieldset>
                  ) : null}
                  <fieldset className="filters__fieldset filters__fieldset--venues">
                    <legend>Venues</legend>
                    <p className="filters__hint filters__hint--tight">
                      Uncheck a venue to <strong>filter it out</strong> (hide all
                      shows there). Use <strong>Select all</strong> /{" "}
                      <strong>Deselect all</strong> to toggle every venue at once.
                      Your choices are saved in this browser.
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
                {rows.map(({ show, effectiveStart }) => (
                  <ShowCard
                    key={show.id}
                    show={show}
                    effectiveStart={effectiveStart}
                    zone={zone}
                    rating={getRating(show.id)}
                    onRate={(next) => setRating(show.id, next)}
                    selected={selectedIds.has(show.id)}
                    onToggleSelect={() => toggleSelected(show.id)}
                    friendLines={friendLinesByShowId[show.id] ?? []}
                  />
                ))}
              </ul>

              {rows.length === 0 ? (
                <p className="empty-day">
                  No shows match your filters for this day.
                </p>
              ) : null}
            </div>
          </>
        ) : null}

        {mainView === "schedule" && dayKeys.length === 0 ? (
          <p className="empty-day">No shows in schedule.</p>
        ) : null}

        {mainView === "search" ? (
          <div className="search-view">
            <label className="search-view__label" htmlFor="act-search-input">
              Search acts
            </label>
            <input
              id="act-search-input"
              type="search"
              className="search-view__input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Title or description contains…"
              autoComplete="off"
              spellCheck={true}
            />
            <ul className="show-list">
              {searchResults.map((show) => (
                <ShowCard
                  key={show.id}
                  show={show}
                  effectiveStart={DateTime.fromISO(show.start, { zone })}
                  zone={zone}
                  rating={getRating(show.id)}
                  onRate={(next) => setRating(show.id, next)}
                  selected={false}
                  onToggleSelect={() => {}}
                  showPick={false}
                  friendLines={friendLinesByShowId[show.id] ?? []}
                />
              ))}
            </ul>
            {searchQuery.trim() && searchResults.length === 0 ? (
              <p className="search-view__empty">No acts match that text.</p>
            ) : null}
            {!searchQuery.trim() ? (
              <p className="search-view__hint">
                Type to find acts by title or description.
              </p>
            ) : null}
          </div>
        ) : null}

        {mainView === "faves" ? (
          <div
            className="faves-view"
            aria-describedby={
              favesShows.length > 0 ? "faves-view-desc" : undefined
            }
          >
            <div className="settings-page__brand faves-view__brand">
              <h1 className="header__title">{`Big Ears ${schedule.meta.year}`}</h1>
              <div className="header__rating-wrap" aria-hidden="true">
                <RatingCountsSummary
                  counts={festivalRatingCounts}
                  className="header__rating-summary"
                />
              </div>
            </div>
            <div className="faves-view__share">
              <div className="settings-page__share-actions">
                <button
                  type="button"
                  className="theme-settings__import-btn"
                  onClick={() => void favesShare.shareOrCopy()}
                >
                  Share…
                </button>
                <button
                  type="button"
                  className="theme-settings__import-btn"
                  onClick={favesShare.copyShareUrl}
                >
                  Copy link
                </button>
              </div>
              {favesShare.shareHint ? (
                <p className="faves-view__share-hint" role="status">
                  {favesShare.shareHint}
                </p>
              ) : null}
            </div>
            {favesShows.length > 0 ? (
              <p className="faves-view__subhead" id="faves-view-desc">
                ❤️ and 👀 acts by day, in date order (hidden venues omitted).
              </p>
            ) : null}
            {favesByDay.map(({ dayKey, shows }) => (
              <section
                key={dayKey}
                className="faves-view__day"
                aria-labelledby={`faves-day-${dayKey}`}
              >
                <h2 className="faves-view__day-heading" id={`faves-day-${dayKey}`}>
                  {tabLabel(dayKey, zone)}
                </h2>
                <ul className="show-list" role="list">
                  {shows.map((show) => (
                    <ShowCard
                      key={show.id}
                      show={show}
                      effectiveStart={DateTime.fromISO(show.start, { zone })}
                      zone={zone}
                      rating={getRating(show.id)}
                      onRate={(next) => setRating(show.id, next)}
                      selected={false}
                      onToggleSelect={() => {}}
                      showPick={false}
                      friendLines={friendLinesByShowId[show.id] ?? []}
                    />
                  ))}
                </ul>
              </section>
            ))}
            {favesShows.length === 0 ? (
              <p className="faves-view__empty">
                No loved or liked acts yet. Rate some shows on the schedule or
                search tab.
              </p>
            ) : null}
          </div>
        ) : null}

        {mainView === "settings" ? (
          <SettingsPanel festivalId={festivalId} />
        ) : null}

        {selectedCount > 0 && mainView === "schedule" && dayKeys.length > 0 ? (
          <div className="bulk-bar" role="region" aria-label="Bulk actions">
            <p className="bulk-bar__count">{selectedCount} selected</p>
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
        ) : null}
      </div>

      {shareImportPayload ? (
        <ImportChooserModal
          payload={shareImportPayload}
          currentFestivalId={festivalId}
          onDone={() => setShareImportPayload(null)}
        />
      ) : null}
      {shareImportError ? (
        <div className="import-flash-error" role="alert">
          <span className="import-flash-error__text">{shareImportError}</span>
          <button
            type="button"
            className="import-flash-error__dismiss"
            onClick={() => setShareImportError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  );
}

export default function App() {
  return (
    <ProfileProvider festivalId={schedule.meta.festivalId}>
      <AppInner />
    </ProfileProvider>
  );
}
