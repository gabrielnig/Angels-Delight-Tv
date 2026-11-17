import type { ThemeStatus } from '@ad/shared';

export interface ThemeRow {
  id: string;
  status: ThemeStatus;
  version: number;
  tokens: unknown;
  logoAssetId: string | null;
  faviconAssetId: string | null;
  createdBy: string | null;
  createdAt: Date;
  publishedAt: Date | null;
}

export type NewThemeRow = Omit<ThemeRow, 'id' | 'createdAt'> & { id?: string; createdAt?: Date };

export interface ListFilter {
  /** `published` means the row was published at some point, `draft` means it never was. */
  kind?: 'published' | 'draft';
  limit: number;
  /** Only rows with a version lower than this (keyset pagination). */
  beforeVersion?: number;
}

/** Everything the theme service needs from storage, bound to one transaction. */
export interface ThemeTx {
  findByStatus(status: ThemeStatus): Promise<ThemeRow | null>;
  findById(id: string): Promise<ThemeRow | null>;
  list(filter: ListFilter): Promise<ThemeRow[]>;
  count(kind?: 'published' | 'draft'): Promise<number>;
  nextVersion(): Promise<number>;
  insert(row: NewThemeRow): Promise<ThemeRow>;
  update(id: string, patch: Partial<Omit<ThemeRow, 'id'>>): Promise<ThemeRow>;
  /** Writes the audit entry in the same transaction, so a change and its audit record commit together. */
  audit(entry: AuditEntry): Promise<void>;
}

export interface ThemeStore {
  /** Runs `fn` in a transaction that serialises theme writers. */
  transaction<T>(fn: (tx: ThemeTx) => Promise<T>): Promise<T>;
  /** Read outside a transaction, used on the hot SSR path. */
  published(): Promise<ThemeRow | null>;
}

export interface AuditEntry {
  action: string;
  actorAccountId: string;
  actorRole: string;
  targetType: string;
  targetId: string;
  outcome: 'success' | 'denied' | 'failure';
  metadata: Record<string, unknown>;
}
