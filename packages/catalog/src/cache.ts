/**
 * A small in memory cache for catalog reads that do not depend on who is asking (M04-S05). It holds results for
 * 60 seconds and is emptied whenever an admin publishes or edits. It never serves an entry past its time, and a
 * failed read is passed to the caller rather than answered from old data, so a database outage shows an error.
 * Personal data (progress, My List, Continue Watching) must never go through it.
 */
export interface CatalogCacheOptions {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

export class CatalogCache {
  private readonly entries = new Map<string, Entry>();
  private readonly loading = new Map<string, Promise<unknown>>();
  private generation = 0;
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: CatalogCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? 60_000;
    this.maxEntries = options.maxEntries ?? 500;
    this.now = options.now ?? Date.now;
  }

  get size(): number {
    return this.entries.size;
  }

  async remember<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.value as T;
    if (hit) this.entries.delete(key);
    const pending = this.loading.get(key);
    if (pending) return pending as Promise<T>;
    const generation = this.generation;
    // Assigned after the closure is created, so the finally block may run before the assignment on a sync throw.
    let run!: Promise<T>;
    // eslint-disable-next-line prefer-const
    run = (async () => {
      try {
        const value = await load();
        if (generation === this.generation) this.store(key, value);
        return value;
      } finally {
        if (this.loading.get(key) === run) this.loading.delete(key);
      }
    })();
    this.loading.set(key, run);
    return run;
  }

  /** Drops everything. Reads already running are returned to their caller but not stored. */
  invalidate(): void {
    this.generation += 1;
    this.entries.clear();
    this.loading.clear();
  }

  private store(key: string, value: unknown): void {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }
}

/** The one cache the web process shares. Admin writes empty it (see audit.ts). */
export const catalogCache = new CatalogCache();
export const invalidateCatalogCache = (): void => catalogCache.invalidate();
