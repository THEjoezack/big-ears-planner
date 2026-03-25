export interface ScheduleMeta {
  festivalId: string;
  name: string;
  year: number;
  timezone: string;
  sourceUrl: string;
  scrapedAt: string;
  showCount: number;
  venueCount: number;
  /** Shows with non-empty description (when scraped with descriptions). */
  descriptionCount?: number;
  /** Shows with at least one scraped link (when scraped with links). */
  linkCount?: number;
}

export interface Venue {
  id: string;
  name: string;
}

/** YouTube, Spotify, social profiles, etc., from the event detail page. */
export interface ShowLink {
  url: string;
  label: string;
}

export interface Show {
  id: string;
  wordpressPostId: number;
  title: string;
  venueId: string;
  venueName: string;
  detailUrl: string | null;
  start: string;
  end: string;
  dateKind: "single_day" | "multi_day_range";
  /** Plain text from the official event page (optional if using older JSON). */
  description?: string;
  /** Media embeds and social URLs scraped from the event page (optional). */
  links?: ShowLink[];
  raw?: {
    dateLine: string;
    times: string[];
  };
}

export interface ScheduleDoc {
  meta: ScheduleMeta;
  venues: Venue[];
  shows: Show[];
}
