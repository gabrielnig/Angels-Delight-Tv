import { desc, eq, sql } from 'drizzle-orm';
import { uiMissingKeys, withAccount, type Database } from '@ad/db';
import type { Actor } from '@ad/shared';

export interface MissingRow {
  locale: string;
  key: string;
  hits: number;
}

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|lighthouse|headless/i;
const MAX_PENDING = 500;
const INTERVAL_MS = 60_000;

export function isBotOrPrefetch(ctx: { userAgent?: string | null; prefetch?: boolean } = {}): boolean {
  return Boolean(ctx.prefetch) || BOT.test(ctx.userAgent ?? '');
}

/**
 * Counts keys viewers saw in English instead of their language. Hits are kept in memory and written once a minute
 * per process. A failing write never reaches the page, and the hits are kept for the next try.
 */
export class MissingKeySink {
  private pending = new Map<string, MissingRow>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private readonly opts: {
      flush: (rows: MissingRow[]) => Promise<void>;
      enabled: () => readonly string[];
      intervalMs?: number;
    },
  ) {}

  record(locale: string, key: string, ctx?: { userAgent?: string | null; prefetch?: boolean }): void {
    try {
      if (locale === 'en' || !this.opts.enabled().includes(locale) || isBotOrPrefetch(ctx)) return;
      const id = `${locale}\u0000${key}`;
      const hit = this.pending.get(id);
      if (hit) hit.hits++;
      else if (this.pending.size < MAX_PENDING) this.pending.set(id, { locale, key, hits: 1 });
      if (!this.timer) {
        this.timer = setTimeout(() => void this.flushNow(), this.opts.intervalMs ?? INTERVAL_MS);
        (this.timer as { unref?: () => void }).unref?.();
      }
    } catch {
      // never break rendering
    }
  }

  async flushNow(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    const rows = [...this.pending.values()];
    if (rows.length === 0) return;
    this.pending = new Map();
    try {
      await this.opts.flush(rows);
    } catch {
      for (const r of rows) {
        const id = `${r.locale}\u0000${r.key}`;
        const hit = this.pending.get(id);
        if (hit) hit.hits += r.hits;
        else if (this.pending.size < MAX_PENDING) this.pending.set(id, r);
      }
    }
  }
}

export interface MissingReportRow {
  key: string;
  hits: number;
  lastSeen: Date;
}

/** Writes through the SECURITY DEFINER function so a viewer request needs no account. */
export class DbMissingStore {
  constructor(
    private readonly db: Database,
    private readonly actor?: Actor,
  ) {}

  async flush(rows: readonly MissingRow[]): Promise<void> {
    for (const r of rows) {
      await this.db.execute(sql`SELECT record_missing_key(${r.locale}, ${r.key}, ${r.hits})`);
    }
  }

  async list(locale: string): Promise<MissingReportRow[]> {
    const run = (tx: Database) =>
      tx
        .select({ key: uiMissingKeys.key, hits: uiMissingKeys.hits, lastSeen: uiMissingKeys.lastSeen })
        .from(uiMissingKeys)
        .where(eq(uiMissingKeys.locale, locale))
        .orderBy(desc(uiMissingKeys.hits), uiMissingKeys.key)
        .limit(500);
    return this.actor ? withAccount(this.db, this.actor, (tx) => run(tx as unknown as Database)) : run(this.db);
  }
}

export class MemoryMissing {
  private rows = new Map<string, MissingReportRow & { locale: string }>();
  async flush(rows: readonly MissingRow[]) {
    for (const r of rows) {
      const id = `${r.locale}\u0000${r.key}`;
      const cur = this.rows.get(id);
      this.rows.set(id, { locale: r.locale, key: r.key, hits: (cur?.hits ?? 0) + r.hits, lastSeen: new Date() });
    }
  }
  async list(locale: string): Promise<MissingReportRow[]> {
    return [...this.rows.values()].filter((r) => r.locale === locale).sort((a, b) => b.hits - a.hits);
  }
}
