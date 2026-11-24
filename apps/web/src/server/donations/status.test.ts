import { issueReceiptToken, type VerifyResult } from '@ad/payments';
import { describe, expect, it, vi } from 'vitest';
import { createStatusHandler, type StatusDeps, type StatusRow } from './status';

const secret = new Uint8Array(32).fill(5);
const REF = 'ad-don-abcdefghij0123456789';
const row = (over: Partial<StatusRow> = {}): StatusRow => ({ status: 'pending', kind: 'one_time', currency: 'NGN', amountMinor: 100000, paidAt: null, ...over });
const get = (query: string) => new Request(`https://site.example/api/donate/status?${query}`);
const goodQuery = (ref = REF) => `reference=${ref}&t=${issueReceiptToken(secret, ref)}`;

function make(over: Partial<StatusDeps> = {}, found: StatusRow | null = row()) {
  const verify = vi.fn(async (): Promise<VerifyResult> => ({ status: 'pending', reference: REF }));
  const deps: StatusDeps = {
    enabled: async () => true,
    provider: { name: 'paystack', initialize: async () => { throw new Error('unused'); }, verify },
    resolveViewer: async () => ({ audience: 'general' }),
    limiter: { consume: async () => ({ allowed: true, retryAfterSeconds: 0 }) },
    lookup: async () => found,
    receiptSecret: secret,
    trustedProxyMode: 'none',
    ...over,
  };
  return { handler: createStatusHandler(deps), verify };
}

describe('GET /api/donate/status', () => {
  it('returns 404 when donations are off', async () => {
    expect((await make({ enabled: async () => false }).handler(get(goodQuery()))).status).toBe(404);
  });
  it('returns 403 for kids and unknown audiences', async () => {
    for (const audience of ['kids', undefined]) {
      expect((await make({ resolveViewer: async () => ({ audience }) }).handler(get(goodQuery()))).status).toBe(403);
    }
  });
  it('returns 404 for a malformed or unknown reference, with the same body', async () => {
    const a = await make({}, null).handler(get(goodQuery()));
    const b = await make().handler(get('reference=nope'));
    expect([a.status, b.status]).toEqual([404, 404]);
    expect(await a.text()).toBe(await b.text());
  });
  it('shows success only when the database says succeeded, with details only for a valid token', async () => {
    const found = row({ status: 'succeeded', paidAt: new Date('2026-11-24T10:00:00Z') });
    const withToken = await (await make({}, found).handler(get(goodQuery()))).json();
    expect(withToken).toMatchObject({ status: 'succeeded', amountMinor: 100000, currency: 'NGN', kind: 'one_time', reference: REF });
    const without = await (await make({}, found).handler(get(`reference=${REF}`))).json();
    expect(without).toEqual({ status: 'succeeded' });
    const wrong = await (await make({}, found).handler(get(`reference=${REF}&t=${issueReceiptToken(secret, 'ad-don-zzzzzzzzzzzzzzzzzzzz')}`))).json();
    expect(wrong).toEqual({ status: 'succeeded' });
  });
  it('treats a paid verify answer as processing while the database still says pending (the webhook settles it)', async () => {
    const { handler, verify } = make({}, row());
    verify.mockResolvedValueOnce({ status: 'paid', reference: REF, amountMinor: 100000, currency: 'NGN', paidAt: new Date() });
    expect((await (await handler(get(goodQuery()))).json()).status).toBe('processing');
  });
  it('maps failed and abandoned to failed and cancelled, from Paystack for a pending row', async () => {
    const failed = make({}, row());
    failed.verify.mockResolvedValueOnce({ status: 'failed', reference: REF });
    expect((await (await failed.handler(get(goodQuery()))).json()).status).toBe('failed');
    const left = make({}, row());
    left.verify.mockResolvedValueOnce({ status: 'abandoned', reference: REF });
    expect((await (await left.handler(get(goodQuery()))).json()).status).toBe('cancelled');
  });
  it('maps stored final states without asking Paystack', async () => {
    for (const [stored, shown] of [['failed', 'failed'], ['abandoned', 'cancelled'], ['needs_review', 'processing'], ['refunded', 'succeeded']] as const) {
      const { handler, verify } = make({}, row({ status: stored }));
      expect((await (await handler(get(goodQuery()))).json()).status).toBe(shown);
      expect(verify).not.toHaveBeenCalled();
    }
  });
  it('says processing when Paystack cannot be reached, and sends the expected amount from the row, never the client', async () => {
    const { handler, verify } = make({}, row());
    verify.mockRejectedValueOnce(new Error('network'));
    expect((await (await handler(get(`${goodQuery()}&amount=1`))).json()).status).toBe('processing');
    expect(verify).toHaveBeenCalledWith(REF, { amountMinor: 100000, currency: 'NGN' });
  });
  it('returns 429 when the address limit is hit and skips Paystack when the per reference limit is hit', async () => {
    expect((await make({ limiter: { consume: async () => ({ allowed: false, retryAfterSeconds: 7 }) } }).handler(get(goodQuery()))).status).toBe(429);
    const names: string[] = [];
    const { handler, verify } = make({ limiter: { consume: async (p) => (names.push(p.name), { allowed: p.name !== 'donate-status-ref', retryAfterSeconds: 7 }) } }, row());
    expect((await (await handler(get(goodQuery()))).json()).status).toBe('processing');
    expect(verify).not.toHaveBeenCalled();
  });
  it('is never cached', async () => {
    expect((await make().handler(get(goodQuery()))).headers.get('cache-control')).toBe('no-store');
  });
});
