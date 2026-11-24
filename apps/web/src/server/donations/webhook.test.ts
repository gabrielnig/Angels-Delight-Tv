import { chargeSuccessBody, signWebhookBody } from '@ad/payments/testing';
import { describe, expect, it, vi } from 'vitest';
import type { StoredEvent } from '@ad/payments';
import { buildPaystackWebhook } from './webhook';

const SECRET = 'sk_test_route';
const kek = new Uint8Array(32).fill(3);
const REF = 'ad-don-abcdefghij0123456789';

const make = (secret: string | null = SECRET) => {
  const insert = vi.fn(async (_event: StoredEvent) => 1 as number | null);
  const enqueue = vi.fn(async (_id: number) => undefined);
  const handler = buildPaystackWebhook({ secretKey: secret ?? undefined, kek, insert, enqueue, log: () => undefined });
  return { handler, insert, enqueue };
};
const signed = (body: string) =>
  new Request('https://site.example/api/webhooks/paystack', { method: 'POST', body, headers: { 'x-paystack-signature': signWebhookBody(body, SECRET) } });

describe('buildPaystackWebhook', () => {
  it('answers 404 and stores nothing when no Paystack key is configured', async () => {
    const { handler, insert } = make(null);
    const res = await handler(signed(chargeSuccessBody({ reference: REF, amount: 1000 })));
    expect(res.status).toBe(404);
    expect(insert).not.toHaveBeenCalled();
  });
  it('stores a sealed payload and queues processing for a good event', async () => {
    const { handler, insert, enqueue } = make();
    const res = await handler(signed(chargeSuccessBody({ reference: REF, amount: 1000, email: 'donor@example.com' })));
    expect(res.status).toBe(200);
    const stored = insert.mock.calls[0]![0];
    expect(stored.eventType).toBe('charge.success');
    expect(Buffer.from(stored.payloadEnc).toString('utf8')).not.toContain('donor@example.com');
    expect(enqueue).toHaveBeenCalledWith(1);
  });
  it('rejects a wrong signature with 401', async () => {
    const { handler, insert } = make();
    const req = new Request('https://site.example/api/webhooks/paystack', { method: 'POST', body: '{}', headers: { 'x-paystack-signature': 'a'.repeat(128) } });
    expect((await handler(req)).status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });
});
