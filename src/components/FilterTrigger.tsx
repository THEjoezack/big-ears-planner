function SearchIcon() {
  return (
    <svg
      className="filter-trigger__icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

type Props = {
  filtersOpen: boolean;
  onToggle: () => void;
  panelId: string;
};

export function FilterTrigger({ filtersOpen, onToggle, panelId }: Props) {
  return (
    <button
      type="button"
      className="filter-trigger"
      aria-expanded={filtersOpen}
      aria-controls={panelId}
      onClick={onToggle}
    >
      <SearchIcon />
      <span className="filter-trigger__sr">Filters and sort</span>
    </button>
  );
}
