import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_BYTES = 16 * 1024;

export interface WebhookDeps {
  /** EMAIL_WEBHOOK_SECRET. The endpoint answers 404 until it is set. */
  secret: string | undefined;
  store: { suppress(address: string, reason: 'bounce' | 'complaint'): Promise<void> };
  warn(message: string, fields?: Record<string, unknown>): void;
}

function validSignature(secret: string, body: string, header: string | null): boolean {
  if (!header || !/^[0-9a-f]{64}$/i.test(header)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(header, 'hex'));
}

/**
 * Provider callback for bounces and complaints (M21-S01 AC2). The body is signed with HMAC SHA256 in
 * `x-webhook-signature`. Other event types are acknowledged and ignored. The address is never logged.
 */
export async function handleEmailWebhook(request: Request, deps: WebhookDeps): Promise<Response> {
  if (!deps.secret) return new Response(null, { status: 404 });
  const body = await request.text();
  if (!validSignature(deps.secret, body, request.headers.get('x-webhook-signature'))) {
    deps.warn('email webhook rejected', { reason: 'signature' });
    return new Response(null, { status: 401 });
  }
  if (Buffer.byteLength(body) > MAX_BYTES) return new Response(null, { status: 413 });
  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (typeof event !== 'object' || event === null || Array.isArray(event)) {
    return new Response(null, { status: 400 });
  }
  const { type, email } = event as { type?: unknown; email?: unknown };
  if (typeof email !== 'string' || !email) return new Response(null, { status: 400 });
  if (type !== 'bounce' && type !== 'complaint') return new Response(null, { status: 204 });
  try {
    await deps.store.suppress(email, type);
  } catch (error) {
    deps.warn('email webhook store failed', { error: String(error) });
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
