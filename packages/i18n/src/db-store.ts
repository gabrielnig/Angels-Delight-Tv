import { and, asc, eq, sql } from 'drizzle-orm';
import { uiTranslations, withAccount, type Database } from '@ad/db';
import type { Actor } from '@ad/shared';
import type { RowStatus, TranslationRow } from './status';
import type { TranslationStore, UpsertInput } from './store';

type Row = typeof uiTranslations.$inferSelect;

function toRow(row: Row): TranslationRow {
  return {
    key: row.key,
    status: row.status,
    text: row.text as TranslationRow['text'],
    sourceHash: row.sourceHash ? Buffer.from(row.sourceHash).toString('hex') : null,
    note: row.note,
    updatedBy: row.updatedBy,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Postgres store. With an actor every call runs in `withAccount`, so row level security shows staff the drafts.
 * Without one only approved rows are visible (the viewer path).
 */
export class DbStore implements TranslationStore {
  constructor(
    private readonly db: Database,
    private readonly actor?: Actor,
  ) {}

  private run<T>(fn: (tx: Database) => Promise<T>): Promise<T> {
    return this.actor ? withAccount(this.db, this.actor, (tx) => fn(tx as unknown as Database)) : fn(this.db);
  }

  list(locale: string) {
    return this.run(async (tx) =>
      (await tx.select().from(uiTranslations).where(eq(uiTranslations.locale, locale)).orderBy(asc(uiTranslations.key))).map(toRow),
    );
  }

  listApproved(locale: string) {
    return this.run(async (tx) =>
      (
        await tx
          .select()
          .from(uiTranslations)
          .where(and(eq(uiTranslations.locale, locale), eq(uiTranslations.status, 'approved')))
      ).map(toRow),
    );
  }

  upsert(locale: string, input: UpsertInput) {
    const values = {
      locale,
      key: input.key,
      text: input.text as string | Record<string, string>,
      status: input.status,
      sourceHash: input.sourceHash ? Buffer.from(input.sourceHash, 'hex') : null,
      note: input.note ?? null,
      updatedBy: input.updatedBy,
      reviewedBy: null,
      reviewedAt: null,
    };
    return this.run(async (tx) => {
      await tx
        .insert(uiTranslations)
        .values(values)
        .onConflictDoUpdate({
          target: [uiTranslations.locale, uiTranslations.key],
          set: { ...values, updatedAt: sql`now()` },
        });
    });
  }

  upsertMany(locale: string, inputs: readonly UpsertInput[]) {
    return this.run(async (tx) => {
      for (const input of inputs) {
        const values = {
          locale,
          key: input.key,
          text: input.text as string | Record<string, string>,
          status: input.status,
          sourceHash: input.sourceHash ? Buffer.from(input.sourceHash, 'hex') : null,
          note: input.note ?? null,
          updatedBy: input.updatedBy,
          reviewedBy: null,
          reviewedAt: null,
        };
        await tx
          .insert(uiTranslations)
          .values(values)
          .onConflictDoUpdate({
            target: [uiTranslations.locale, uiTranslations.key],
            set: { ...values, updatedAt: sql`now()` },
          });
      }
    });
  }

  setStatus(locale: string, key: string, status: RowStatus, reviewer: string | null) {
    return this.run(async (tx) => {
      const set =
        status === 'approved'
          ? { status, reviewedBy: reviewer, reviewedAt: sql`now()`, updatedAt: sql`now()` }
          : { status, updatedAt: sql`now()` };
      const done = await tx
        .update(uiTranslations)
        .set(set)
        .where(and(eq(uiTranslations.locale, locale), eq(uiTranslations.key, key)))
        .returning({ id: uiTranslations.id });
      if (done.length === 0) throw new Error('No such translation');
    });
  }
}
