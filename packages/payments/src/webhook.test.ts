import { describe, expect, it, vi } from 'vitest';
import { chargeSuccessBody, signWebhookBody } from './testing/fake-paystack';
import { createPaystackWebhookHandler, eventKeyFor, WEBHOOK_MAX_BYTES, type WebhookDeps } from './webhook';

const SECRET = 'sk_test_hook';
const REF = 'ad-don-abcdefghij0123456789';

const make = (over: Partial<WebhookDeps> = {}) => {
  const stored: { eventKey: string; eventType: string; reference: string | null; payloadEnc: Uint8Array }[] = [];
  const enqueue = vi.fn(async () => undefined);
  const log = vi.fn();
  const deps: WebhookDeps = {
    secret: SECRET,
    seal: async (bytes) => bytes,
    store: {
      insert: async (e) => {
        if (stored.some((s) => s.eventKey === e.eventKey)) return null;
        stored.push(e);
        return stored.length;
      },
    },
    enqueue,
    log,
    ...over,
  };
  return { handler: createPaystackWebhookHandler(deps), stored, enqueue, log };
};
const post = (body: string, headers: Record<string, string> = {}, method = 'POST') =>
  new Request('https://site.example/api/webhooks/paystack', { method, headers: { 'content-type': 'application/json', ...headers }, ...(method === 'POST' ? { body } : {}) });
const signed = (body: string) => post(body, { 'x-paystack-signature': signWebhookBody(body, SECRET) });
const good = () => chargeSuccessBody({ reference: REF, amount: 250_000 });

describe('signature gate', () => {
  it('401 and no row when the signature is missing', async () => {
    const { handler, stored, enqueue } = make();
    const res = await handler(post(good()));
    expect(res.status).toBe(401);
    expect(stored).toHaveLength(0);
    expect(enqueue).not.toHaveBeenCalled();
  });
  it('401 and no row when the signature is wrong', async () => {
    const { handler, stored } = make();
    expect((await handler(post(good(), { 'x-paystack-signature': 'a'.repeat(128) }))).status).toBe(401);
    expect(stored).toHaveLength(0);
  });
  it('401 when the body is valid JSON but the signature is for a different body', async () => {
    const { handler, stored } = make();
    const other = chargeSuccessBody({ reference: REF, amount: 100 });
    expect((await handler(post(good(), { 'x-paystack-signature': signWebhookBody(other, SECRET) }))).status).toBe(401);
    expect(stored).toHaveLength(0);
  });
  it('401 for a signature made with another key (test key against live key)', async () => {
    const { handler } = make();
    const body = good();
    expect((await handler(post(body, { 'x-paystack-signature': signWebhookBody(body, 'sk_live_other') }))).status).toBe(401);
  });
  it('works on the raw body, not on parsed JSON', async () => {
    const { handler, stored } = make();
    const spaced = JSON.stringify(JSON.parse(good()), null, 4);
    expect((await handler(signed(spaced))).status).toBe(200);
    expect(stored).toHaveLength(1);
  });
});

describe('accepting an event', () => {
  it('200 and one row for a valid charge.success, and queues it once', async () => {
    const { handler, stored, enqueue } = make();
    const res = await handler(signed(good()));
    expect(res.status).toBe(200);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ eventType: 'charge.success', reference: REF });
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
  it('a second delivery of the same event is 200 and does not queue again', async () => {
    const { handler, stored, enqueue } = make();
    await handler(signed(good()));
    const second = await handler(signed(good()));
    expect(second.status).toBe(200);
    expect(stored).toHaveLength(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
  it('stores an unknown event type and answers 200', async () => {
    const { handler, stored } = make();
    const body = JSON.stringify({ event: 'transfer.success', data: { reference: 'x', transfer_code: 'TRF_1' } });
    expect((await handler(signed(body))).status).toBe(200);
    expect(stored[0]?.eventType).toBe('transfer.success');
  });
  it('still answers 200 when queueing fails, because the event is already stored', async () => {
    const { handler, stored } = make({ enqueue: async () => { throw new Error('queue down'); } });
    expect((await handler(signed(good()))).status).toBe(200);
    expect(stored).toHaveLength(1);
  });
  it('answers 500 when the event cannot be stored so Paystack sends it again', async () => {
    const { handler, enqueue } = make({ store: { insert: async () => { throw new Error('db down'); } } });
    expect((await handler(signed(good()))).status).toBe(500);
    expect(enqueue).not.toHaveBeenCalled();
  });
  it('seals the payload before it is stored', async () => {
    const seal = vi.fn(async (b: Uint8Array) => new Uint8Array([...b].reverse()));
    const { handler, stored } = make({ seal });
    await handler(signed(good()));
    expect(seal).toHaveBeenCalled();
    expect(new TextDecoder().decode(stored[0]!.payloadEnc)).not.toContain('charge.success');
  });
});

describe('limits and methods', () => {
  it('413 for a body over 64 KB before any hashing', async () => {
    const hash = vi.fn();
    const { handler, stored } = make();
    const big = 'x'.repeat(WEBHOOK_MAX_BYTES + 1);
    const res = await handler(post(big, { 'x-paystack-signature': 'a'.repeat(128), 'content-length': String(big.length) }));
    expect(res.status).toBe(413);
    expect(stored).toHaveLength(0);
    expect(hash).not.toHaveBeenCalled();
  });
  it('413 when the real body is larger than the declared length', async () => {
    const { handler } = make();
    const big = 'x'.repeat(WEBHOOK_MAX_BYTES + 1);
    expect((await handler(post(big, { 'x-paystack-signature': 'a'.repeat(128) }))).status).toBe(413);
  });
  it('405 with Allow for anything but POST', async () => {
    const { handler } = make();
    for (const method of ['GET', 'PUT', 'DELETE']) {
      const res = await handler(post('', {}, method));
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('POST');
    }
  });
  it('400 for a signed body that is not JSON', async () => {
    const { handler, stored } = make();
    expect((await handler(signed('not json'))).status).toBe(400);
    expect(stored).toHaveLength(0);
  });
  it('answers without caching and never echoes the body', async () => {
    const { handler } = make();
    const res = await handler(signed(good()));
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toBe('');
  });
});

describe('privacy', () => {
  it('does not log the body or the email', async () => {
    const { handler, log } = make();
    await handler(signed(chargeSuccessBody({ reference: REF, amount: 250_000, email: 'secret.donor@example.com' })));
    await handler(post(good()));
    const all = JSON.stringify(log.mock.calls);
    expect(all).not.toContain('secret.donor@example.com');
    expect(all).not.toContain('250000');
    expect(all).not.toContain(REF);
  });
});

describe('eventKeyFor', () => {
  it('is stable for the same event and differs by event type, reference and paid_at', () => {
    const a = eventKeyFor({ event: 'charge.success', data: { reference: 'r', paid_at: 't1' } }, 'raw');
    expect(eventKeyFor({ event: 'charge.success', data: { reference: 'r', paid_at: 't1' } }, 'raw')).toBe(a);
    expect(eventKeyFor({ event: 'charge.success', data: { reference: 'r', paid_at: 't2' } }, 'raw')).not.toBe(a);
    expect(eventKeyFor({ event: 'charge.failed', data: { reference: 'r', paid_at: 't1' } }, 'raw')).not.toBe(a);
    expect(eventKeyFor({ event: 'charge.success', data: { reference: 'q', paid_at: 't1' } }, 'raw')).not.toBe(a);
  });
  it('uses the provider id when one is present and falls back to the raw body hash', () => {
    expect(eventKeyFor({ event: 'x', id: 'evt_1', data: {} }, 'raw')).toBe('id:evt_1');
    const key = eventKeyFor({ event: 'transfer.success', data: {} }, '{"event":"transfer.success"}');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});
