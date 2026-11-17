const SECRET_KEY =
  /pass(word)?|secret|token|authorization|cookie|api_?key|private_?key|kek|pepper|credential|otp|recovery_?code|session_?id/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const MAX_STRING = 500;
const MAX_ARRAY = 50;
const MAX_DEPTH = 6;

function clean(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'string') {
    const masked = value.replace(EMAIL, '[email]');
    return masked.length > MAX_STRING ? `${masked.slice(0, MAX_STRING)}…` : masked;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return '[depth]';
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value))
    return value.slice(0, MAX_ARRAY).map((item) => clean(item, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = SECRET_KEY.test(key) ? '[redacted]' : clean(inner, depth + 1, seen);
  }
  return out;
}

/** Copies a value for storage in the audit log: secrets replaced, emails masked, size and depth bounded. */
export function redact(value: unknown): unknown {
  return clean(value, 0, new WeakSet());
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The fields that differ between two snapshots, redacted. Either side may be missing (create or delete). */
export function diffChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const a = before ?? {};
  const b = after ?? {};
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (same(a[key], b[key])) continue;
    if (key in a) changedBefore[key] = a[key];
    if (key in b) changedAfter[key] = b[key];
  }
  return {
    before: redact(changedBefore) as Record<string, unknown>,
    after: redact(changedAfter) as Record<string, unknown>,
  };
}
