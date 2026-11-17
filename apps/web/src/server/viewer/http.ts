import { AppError, RateLimited, ValidationFailed } from '@ad/shared';
import type { ZodType } from 'zod';

export const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

export function json(
  data: unknown,
  init: { status?: number; headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', NO_STORE['Cache-Control']);
  return Response.json(data, { status: init.status ?? 200, headers });
}

/** Turns a service error into the stable JSON error shape. Anything else is left for withRequest to report as 500. */
export function errorResponse(error: unknown): Response | null {
  if (!(error instanceof AppError)) return null;
  const headers = new Headers();
  if (error instanceof RateLimited) headers.set('Retry-After', String(error.retryAfterSeconds));
  const body: Record<string, unknown> = { code: error.code, message: error.message };
  if (error instanceof ValidationFailed) body.fields = error.fields;
  if (error instanceof RateLimited) body.retryAfterSeconds = error.retryAfterSeconds;
  return json({ error: body }, { status: error.status, headers });
}

function issuesToFields(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

export function parseWith<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ValidationFailed(issuesToFields(result.error));
  return result.data;
}

export function queryObject(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) out[key] ??= value;
  return out;
}

const MAX_BODY_BYTES = 16_384;

/** Reads a small JSON body. sendBeacon sends text/plain, so the content type is not required. */
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new ValidationFailed({ _: ['Request is too large'] });
  try {
    return text.length === 0 ? {} : JSON.parse(text);
  } catch {
    throw new ValidationFailed({ _: ['Send valid JSON'] });
  }
}
