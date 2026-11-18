import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { handleEmailWebhook, type WebhookDeps } from './webhook';

const secret = 'whsec_test_secret_value';
const sign = (body: string, key = secret) => createHmac('sha256', key).update(body).digest('hex');

function deps(
  over: Partial<WebhookDeps> = {},
): WebhookDeps & { suppress: ReturnType<typeof vi.fn> } {
  const suppress = vi.fn(async () => {});
  return { secret, store: { suppress }, warn: () => {}, ...over, suppress } as never;
}

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request('https://tv.example.org/api/webhooks/email', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('email bounce webhook', () => {
  it('flags the address on a signed bounce', async () => {
    const d = deps();
    const body = JSON.stringify({ type: 'bounce', email: 'gone@example.com' });
    const res = await handleEmailWebhook(post(body, { 'x-webhook-signature': sign(body) }), d);
    expect(res.status).toBe(204);
    expect(d.suppress).toHaveBeenCalledWith('gone@example.com', 'bounce');
  });

  it('flags a complaint too', async () => {
    const d = deps();
    const body = JSON.stringify({ type: 'complaint', email: 'a@example.com' });
    await handleEmailWebhook(post(body, { 'x-webhook-signature': sign(body) }), d);
    expect(d.suppress).toHaveBeenCalledWith('a@example.com', 'complaint');
  });

  it('rejects a missing or wrong signature and changes nothing', async () => {
    const d = deps();
    const body = JSON.stringify({ type: 'bounce', email: 'a@example.com' });
    expect((await handleEmailWebhook(post(body), d)).status).toBe(401);
    expect(
      (await handleEmailWebhook(post(body, { 'x-webhook-signature': sign(body, 'other') }), d))
        .status,
    ).toBe(401);
    expect((await handleEmailWebhook(post(body, { 'x-webhook-signature': 'zz' }), d)).status).toBe(
      401,
    );
    expect(d.suppress).not.toHaveBeenCalled();
  });

  it('is closed when no secret is configured', async () => {
    const d = deps({ secret: undefined });
    const body = JSON.stringify({ type: 'bounce', email: 'a@example.com' });
    const res = await handleEmailWebhook(post(body, { 'x-webhook-signature': sign(body, '') }), d);
    expect(res.status).toBe(404);
    expect(d.suppress).not.toHaveBeenCalled();
  });

  it('answers 400 for a signed body it cannot use, and ignores other event types', async () => {
    const d = deps();
    for (const body of ['not json', JSON.stringify({ type: 'bounce' }), JSON.stringify([])]) {
      const res = await handleEmailWebhook(post(body, { 'x-webhook-signature': sign(body) }), d);
      expect(res.status).toBe(400);
    }
    const open = JSON.stringify({ type: 'opened', email: 'a@example.com' });
    const res = await handleEmailWebhook(post(open, { 'x-webhook-signature': sign(open) }), d);
    expect(res.status).toBe(204);
    expect(d.suppress).not.toHaveBeenCalled();
  });

  it('refuses a body over 16 KB before reading it as json', async () => {
    const d = deps();
    const body = JSON.stringify({
      type: 'bounce',
      email: 'a@example.com',
      pad: 'x'.repeat(20_000),
    });
    const res = await handleEmailWebhook(post(body, { 'x-webhook-signature': sign(body) }), d);
    expect(res.status).toBe(413);
  });

  it('answers 500 so the provider retries when the store fails, without leaking the address in logs', async () => {
    const warn = vi.fn();
    const d = deps({ warn });
    d.suppress.mockRejectedValueOnce(new Error('db down'));
    const body = JSON.stringify({ type: 'bounce', email: 'secret@example.com' });
    const res = await handleEmailWebhook(post(body, { 'x-webhook-signature': sign(body) }), d);
    expect(res.status).toBe(500);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret@example.com');
  });
});
