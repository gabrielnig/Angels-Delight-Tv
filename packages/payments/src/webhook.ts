import { createHash } from 'node:crypto';
import { verifyPaystackSignature } from './signature';

export const WEBHOOK_MAX_BYTES = 64 * 1024;

export interface StoredEvent {
  eventKey: string;
  eventType: string;
  reference: string | null;
  payloadEnc: Uint8Array;
}

export interface WebhookDeps {
  secret: string;
  /** Encrypts the raw body. The payload holds the donor email, so it is never stored in the clear. */
  seal(bytes: Uint8Array): Promise<Uint8Array>;
  /** Stores the event. Returns its id, or null when the same event was already stored. */
  store: { insert(event: StoredEvent): Promise<number | null> };
  /** Queues processing for a stored event. */
  enqueue(eventId: number): Promise<void>;
  /** Receives short facts only (event type, outcome). Never the body, email or reference. */
  log(fact: { outcome: string; eventType?: string }): void;
}

/** Reads the body but stops as soon as it passes the cap, so a lying content-length cannot make us buffer a lot. */
async function readCapped(request: Request, max: number): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

const reply = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/**
 * Paystack sends no event id, so the key is a hash of the event type, reference and paid_at. An id is used when
 * one ever appears. With neither, the hash of the raw body keeps repeats from piling up.
 */
export function eventKeyFor(parsed: unknown, raw: string): string {
  const body = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  const id = str(body.id);
  if (id) return `id:${id}`;
  const data = (body.data && typeof body.data === 'object' ? body.data : {}) as Record<string, unknown>;
  const reference = str(data.reference) ?? str(data.transaction_reference);
  const type = str(body.event);
  if (!type || !reference) return createHash('sha256').update(raw).digest('hex');
  const paidAt = str(data.paid_at) ?? str(data.created_at) ?? str(data.refunded_at) ?? '';
  return createHash('sha256').update(`${type}\n${reference}\n${paidAt}`).digest('hex');
}

/**
 * POST /api/webhooks/paystack. Order matters: size first, then the signature over the raw bytes, then parsing.
 * Nothing is stored or queued for a request that fails the signature. After storage the answer is 200 whatever
 * happens to processing, because Paystack retries on anything else and the stored event is the record.
 */
export function createPaystackWebhookHandler(deps: WebhookDeps) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return reply(405, { Allow: 'POST' });

    const declared = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(declared) && declared > WEBHOOK_MAX_BYTES) {
      deps.log({ outcome: 'too_large' });
      return reply(413);
    }
    const bytes = await readCapped(request, WEBHOOK_MAX_BYTES);
    if (bytes === null) {
      deps.log({ outcome: 'too_large' });
      return reply(413);
    }

    if (!verifyPaystackSignature(bytes, request.headers.get('x-paystack-signature'), deps.secret)) {
      deps.log({ outcome: 'bad_signature' });
      return reply(401);
    }

    const raw = new TextDecoder().decode(bytes);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      deps.log({ outcome: 'bad_json' });
      return reply(400);
    }
    const body = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
    const eventType = str(body.event);
    if (!eventType) {
      deps.log({ outcome: 'no_event' });
      return reply(400);
    }
    const data = (body.data && typeof body.data === 'object' ? body.data : {}) as Record<string, unknown>;
    const reference = str(data.reference) ?? str(data.transaction_reference);

    let id: number | null;
    try {
      id = await deps.store.insert({
        eventKey: eventKeyFor(parsed, raw),
        eventType,
        reference,
        payloadEnc: await deps.seal(bytes),
      });
    } catch {
      deps.log({ outcome: 'store_failed', eventType });
      return reply(500);
    }
    if (id === null) {
      deps.log({ outcome: 'duplicate', eventType });
      return reply(200);
    }
    try {
      await deps.enqueue(id);
    } catch {
      // The reconcile job picks up stored events that were never processed.
      deps.log({ outcome: 'enqueue_failed', eventType });
      return reply(200);
    }
    deps.log({ outcome: 'accepted', eventType });
    return reply(200);
  };
}
