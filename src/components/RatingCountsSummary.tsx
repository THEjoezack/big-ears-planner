export type RatingCounts = {
  love: number;
  like: number;
  skip: number;
  unset: number;
};

type Props = {
  counts: RatingCounts;
  className?: string;
};

export function RatingCountsSummary({ counts, className }: Props) {
  const { love, like, skip, unset } = counts;
  const ariaLabel = `Love ${love}, Like ${like}, Skip ${skip}, Not set ${unset}`;

  return (
    <p
      className={className ? `rating-summary ${className}` : "rating-summary"}
      aria-label={ariaLabel}
    >
      <span className="rating-summary__item rating-summary__item--love">
        <span aria-hidden>❤️</span>{" "}
        <span className="rating-summary__num">{love}</span>
      </span>
      <span className="rating-summary__sep" aria-hidden>
        ·
      </span>
      <span className="rating-summary__item rating-summary__item--like">
        <span aria-hidden>👀</span>{" "}
        <span className="rating-summary__num">{like}</span>
      </span>
      <span className="rating-summary__sep" aria-hidden>
        ·
      </span>
      <span className="rating-summary__item rating-summary__item--skip">
        <span className="rating-summary__skip-mark" aria-hidden>
          ×
        </span>{" "}
        <span className="rating-summary__num">{skip}</span>
      </span>
      <span className="rating-summary__sep" aria-hidden>
        ·
      </span>
      <span className="rating-summary__item rating-summary__item--unset">
        <span className="rating-summary__unset-mark" aria-hidden>
          ?
        </span>{" "}
        <span className="rating-summary__num">{unset}</span>
      </span>
    </p>
  );
}
