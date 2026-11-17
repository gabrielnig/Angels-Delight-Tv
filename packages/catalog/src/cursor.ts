import { ValidationFailed } from '@ad/shared';

export function encodeCursor(value: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

/** Cursors are opaque to clients but not secret: a forged one only moves the page position. Shape is still checked. */
export function decodeCursor<T>(raw: string, guard: (value: unknown) => value is T): T {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (guard(parsed)) return parsed;
  } catch {
    // fall through to the single validation error below
  }
  throw new ValidationFailed({ cursor: ['Invalid cursor'] });
}

export function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  if (limit === undefined) return fallback;
  return Math.min(Math.max(Math.trunc(limit), 1), max);
}
