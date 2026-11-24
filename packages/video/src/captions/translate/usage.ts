import { schema, type Database } from '@ad/db';
import { and, eq, sql } from 'drizzle-orm';
import { PipelineError } from '../../failure';
import type { TranslateRequest, Translator } from './types';

export function assertWithinCap(a: { used: number; adding: number; cap: number }): void {
  if (a.cap <= 0) {
    throw new PipelineError('caption_service_unavailable', 'translation cap is 0, API use is not allowed', true);
  }
  if (a.used + a.adding > a.cap) {
    throw new PipelineError('caption_service_unavailable', 'monthly translation character cap reached', true);
  }
}

/** Month key used by `translation_usage.month`: the first day of the UTC month. */
export function monthStart(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export interface UsageStore {
  used(month: string, provider: string): Promise<number>;
  add(month: string, provider: string, chars: number): Promise<void>;
}

export class MemoryUsageStore implements UsageStore {
  private readonly rows = new Map<string, number>();
  async used(month: string, provider: string) {
    return this.rows.get(`${month}|${provider}`) ?? 0;
  }
  async add(month: string, provider: string, chars: number) {
    const k = `${month}|${provider}`;
    this.rows.set(k, (this.rows.get(k) ?? 0) + chars);
  }
}

/** `translation_usage(month, provider, chars)`. The add is one upsert so two workers cannot lose a count. */
export class DbUsageStore implements UsageStore {
  constructor(private readonly db: Database) {}
  async used(month: string, provider: string) {
    const [row] = await this.db
      .select({ chars: schema.translationUsage.chars })
      .from(schema.translationUsage)
      .where(and(eq(schema.translationUsage.month, month), eq(schema.translationUsage.provider, provider)))
      .limit(1);
    return row?.chars ?? 0;
  }
  async add(month: string, provider: string, chars: number) {
    await this.db
      .insert(schema.translationUsage)
      .values({ month, provider, chars })
      .onConflictDoUpdate({
        target: [schema.translationUsage.month, schema.translationUsage.provider],
        set: { chars: sql`${schema.translationUsage.chars} + ${chars}` },
      });
  }
}

export interface UsageCapOptions {
  store: UsageStore;
  /** TRANSLATE_MONTHLY_CHAR_CAP. 0 means no API use. */
  cap: number;
  now?: () => Date;
}

/**
 * Cost guard for paid providers (not for a self hosted engine). A call that would cross the monthly cap is
 * refused before the provider is reached. The count is added only after the provider answered.
 */
export function withUsageCap(inner: Translator, o: UsageCapOptions): Translator {
  return {
    name: inner.name,
    supports: (s, t) => inner.supports(s, t),
    async translate(req: TranslateRequest) {
      const month = monthStart((o.now ?? (() => new Date()))());
      const adding = req.texts.reduce((n, s) => n + s.length, 0);
      assertWithinCap({ used: await o.store.used(month, inner.name), adding, cap: o.cap });
      const res = await inner.translate(req);
      await o.store.add(month, inner.name, res.chars);
      return res;
    },
  };
}
