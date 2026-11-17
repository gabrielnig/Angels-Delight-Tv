import { RateLimited, ValidationFailed, isAppError } from '@ad/shared';

const NO_STORE = { 'cache-control': 'no-store' };
const MAX_BODY_BYTES = 64 * 1024;

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...NO_STORE, ...headers },
  });
}

/**
 * One mapping from errors to responses. Unknown errors never leak their message, the caller logs them
 * through `onUnexpected` with a request id.
 */
export function errorResponse(error: unknown, onUnexpected?: (error: unknown) => void): Response {
  if (!isAppError(error)) {
    onUnexpected?.(error);
    return jsonResponse({ error: { code: 'internal', message: 'Something went wrong.' } }, 500);
  }
  const extra: Record<string, unknown> = {};
  if (error instanceof ValidationFailed) extra.fields = error.fields;
  const missing = (error as { missing?: unknown }).missing;
  if (Array.isArray(missing)) extra.missing = missing;
  const headers: Record<string, string> = {};
  if (error instanceof RateLimited) headers['retry-after'] = String(error.retryAfterSeconds);
  return jsonResponse(
    { error: { code: error.code, message: error.message, ...extra } },
    error.status,
    headers,
  );
}

/** Small JSON bodies only. Large or malformed bodies are validation failures, not crashes. */
export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES)
    throw new ValidationFailed({ body: ['The request is too large.'] });
  try {
    return text === '' ? {} : JSON.parse(text);
  } catch {
    throw new ValidationFailed({ body: ['The request is not valid JSON.'] });
  }
}
