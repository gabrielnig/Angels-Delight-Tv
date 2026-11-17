/** Tiny per process cache. Each web instance holds one value for `ttlMs`, so a publish on another instance shows within the TTL. */
export class TtlCache<T> {
  private value: { data: T; expires: number } | null = null;

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(): T | undefined {
    if (this.value && this.value.expires > this.now()) return this.value.data;
    this.value = null;
    return undefined;
  }

  set(data: T, ttlMs: number = this.ttlMs): void {
    this.value = { data, expires: this.now() + ttlMs };
  }

  bust(): void {
    this.value = null;
  }
}

/** M18-S07 AC1: a publish reaches every viewer within 60 seconds. */
export const THEME_CACHE_TTL_MS = 60_000;
