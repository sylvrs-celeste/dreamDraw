/** Mirrors the Pydantic response models in backend/app/schemas/entry.py.
 *  These are hand-kept; if a response shape changes on the server, it changes
 *  here too. */

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface TagWithCount extends Tag {
  entry_count: number;
}

export interface Image {
  id: string;
  alt_text: string | null;
  sort_order: number;
  /** Presigned and good for one hour. Anything caching these must expire first. */
  url_thumb: string;
  url_medium: string;
  width: number;
  height: number;
  mime_type: string;
}

export interface EntrySummary {
  id: string;
  title: string;
  slug: string;
  art_date: string;
  tags: Tag[];
  cover_image: Image | null;
}

export interface EntryDetail extends EntrySummary {
  description: string | null;
  images: Image[];
  created_at: string;
  updated_at: string;
  /** Adjacent entries by art date. Null at either end of the journey. */
  newer_slug: string | null;
  older_slug: string | null;
}

export interface EntryPage {
  items: EntrySummary[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
}

export interface SessionStatus {
  authenticated: boolean;
}
