import type { Database } from '@ad/db';

/** The transaction handle services receive. Every service runs inside withAccount, so this is never a bare pool. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Who the catalog is being read for. Derived from the profile on the server, never from client input. */
export interface Audience {
  kids: boolean;
}

export interface CatalogContext {
  /** Public base url of the media bucket, for example https://media.example.com. No trailing slash. */
  mediaOrigin: string;
  now: () => Date;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export type TitleKind = 'video' | 'series';

export interface TitleRef {
  kind: TitleKind;
  id: string;
}
