import { createPaystackWebhookHandler, sealPayload, type StoredEvent } from '@ad/payments';

export interface PaystackWebhookDeps {
  secretKey: string | undefined;
  kek: Uint8Array;
  insert(event: StoredEvent): Promise<number | null>;
  enqueue(eventId: number): Promise<void>;
  log(fact: { outcome: string; eventType?: string }): void;
}

/**
 * The Paystack webhook endpoint. With no key set the endpoint does not exist (404), so a deployment that never
 * switched donations on exposes nothing.
 */
export function buildPaystackWebhook(deps: PaystackWebhookDeps): (request: Request) => Promise<Response> {
  const { secretKey } = deps;
  if (!secretKey) return async () => new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return createPaystackWebhookHandler({
    secret: secretKey,
    seal: sealPayload(deps.kek),
    store: { insert: deps.insert },
    enqueue: deps.enqueue,
    log: deps.log,
  });
}
