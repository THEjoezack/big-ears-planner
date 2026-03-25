import type { DateTime } from "luxon";

import { ExternalLink } from "@/components/ExternalLink";
import type { ShowRating } from "@/hooks/useShowRatings";
import { formatShowRange } from "@/lib/scheduleByDay";
import type { Show } from "@/types/schedule";

export type FriendRatingLine = {
  label: string;
  rating: Exclude<ShowRating, "unset">;
};

type Props = {
  show: Show;
  effectiveStart: DateTime;
  zone: string;
  rating: ShowRating;
  onRate: (next: ShowRating) => void;
  selected: boolean;
  onToggleSelect: () => void;
  /** When false, hides bulk-selection checkbox (e.g. on Search tab). */
  showPick?: boolean;
  friendLines?: FriendRatingLine[];
  /** When true, show calendar day + weekday in the time column (e.g. Search). */
  showDayOfWeek?: boolean;
};

function friendRatingSymbol(rating: FriendRatingLine["rating"]) {
  switch (rating) {
    case "love":
      return "❤️";
    case "like":
      return "👀";
    case "skip":
      return "×";
    default:
      return "";
  }
}

export function ShowCard({
  show,
  effectiveStart,
  zone,
  rating: r,
  onRate,
  selected,
  onToggleSelect,
  showPick = true,
  friendLines = [],
  showDayOfWeek = false,
}: Props) {
  return (
    <li
      className={`show-card${selected && showPick ? " is-selected" : ""}${
        r === "love" || r === "like" || r === "skip" ? ` show-card--${r}` : ""
      }${showPick ? "" : " show-card--no-pick"}`}
    >
      {showPick ? (
        <div className="show-card__pick">
          <input
            type="checkbox"
            className="show-card__checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${show.title}`}
          />
        </div>
      ) : null}
      <div className="show-card__time">
        {showDayOfWeek ? (
          <span className="show-card__dow">
            {effectiveStart.toFormat("ccc LLL d")}
          </span>
        ) : null}
        <span className="show-card__sort-time">
          {effectiveStart.toFormat("h:mm a")}
        </span>
        <span className="show-card__range">{formatShowRange(show, zone)}</span>
      </div>
      <div className="show-card__body">
        <h2 className="show-card__title">
          {show.detailUrl ? (
            <ExternalLink href={show.detailUrl}>{show.title}</ExternalLink>
          ) : (
            show.title
          )}
        </h2>
        <p className="show-card__venue">{show.venueName}</p>
        {show.description?.trim() || (show.links && show.links.length > 0) ? (
          <details className="show-card__details">
            <summary className="show-card__summary">Details</summary>
            <div className="show-card__details-inner">
              {show.description?.trim() ? (
                <div className="show-card__description">
                  {show.description.trim()}
                </div>
              ) : null}
              {show.links && show.links.length > 0 ? (
                <ul className="show-card__links">
                  {show.links.map((link, i) => (
                    <li key={`${link.url}-${i}`}>
                      <ExternalLink href={link.url}>{link.label}</ExternalLink>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
      <div className="show-card__rate-wrap">
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
              onClick={() => onRate(r === value ? "unset" : value)}
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
        {friendLines.length > 0 ? (
          <ul className="show-card__friends" aria-label="Friends’ ratings">
            {friendLines.map((line, i) => (
              <li
                key={`${line.label}-${line.rating}-${i}`}
                className={`show-card__friend show-card__friend--${line.rating}`}
              >
                <span className="show-card__friend-name">{line.label}</span>{" "}
                <span
                  className={`show-card__friend-r show-card__friend-r--${line.rating}`}
                  aria-hidden
                >
                  {friendRatingSymbol(line.rating)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}
