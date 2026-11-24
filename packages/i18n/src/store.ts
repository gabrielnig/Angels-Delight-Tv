import type { MessageText } from '@ad/shared/messages';
import type { RowStatus, TranslationRow } from './status';

export interface UpsertInput {
  key: string;
  text: MessageText;
  status: RowStatus;
  sourceHash: string | null;
  updatedBy: string | null;
  note?: string | null;
}

/** Where translation rows live. The database store is used in production, the memory store in tests. */
export interface TranslationStore {
  list(locale: string): Promise<TranslationRow[]>;
  listApproved(locale: string): Promise<TranslationRow[]>;
  upsert(locale: string, input: UpsertInput): Promise<void>;
  setStatus(locale: string, key: string, status: RowStatus, reviewer: string | null): Promise<void>;
  /** All rows or none. */
  upsertMany(locale: string, inputs: readonly UpsertInput[]): Promise<void>;
}

export class MemoryStore implements TranslationStore {
  private rows = new Map<string, TranslationRow>();
  private id = (locale: string, key: string) => `${locale}\u0000${key}`;

  async list(locale: string) {
    return [...this.rows.entries()].filter(([k]) => k.startsWith(`${locale}\u0000`)).map(([, v]) => v);
  }
  async listApproved(locale: string) {
    return (await this.list(locale)).filter((r) => r.status === 'approved');
  }
  async upsert(locale: string, input: UpsertInput) {
    this.rows.set(this.id(locale, input.key), {
      key: input.key,
      text: input.text,
      status: input.status,
      sourceHash: input.sourceHash,
      note: input.note ?? null,
      updatedBy: input.updatedBy,
      reviewedBy: null,
      reviewedAt: null,
      updatedAt: new Date(),
    });
  }
  async upsertMany(locale: string, inputs: readonly UpsertInput[]) {
    for (const input of inputs) await this.upsert(locale, input);
  }
  async setStatus(locale: string, key: string, status: RowStatus, reviewer: string | null) {
    const row = this.rows.get(this.id(locale, key));
    if (!row) throw new Error('No such translation');
    this.rows.set(this.id(locale, key), {
      ...row,
      status,
      reviewedBy: status === 'approved' ? reviewer : row.reviewedBy,
      reviewedAt: status === 'approved' ? new Date() : row.reviewedAt,
      updatedAt: new Date(),
    });
  }
}
