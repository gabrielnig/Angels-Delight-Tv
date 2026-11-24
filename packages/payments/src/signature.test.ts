import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyPaystackSignature } from './signature';

const secret = 'sk_test_secret';
const body = JSON.stringify({ event: 'charge.success', data: { reference: 'ad-don-abc', amount: 100000 } });
const sign = (raw: string | Uint8Array, key = secret) => createHmac('sha512', key).update(raw).digest('hex');

describe('verifyPaystackSignature', () => {
  it('accepts a correct sha512 signature over the raw body', () => {
    expect(verifyPaystackSignature(body, sign(body), secret)).toBe(true);
    const bytes = new TextEncoder().encode(body);
    expect(verifyPaystackSignature(bytes, sign(bytes), secret)).toBe(true);
  });
  it('rejects a signature for a body changed by one byte', () => {
    expect(verifyPaystackSignature(body.replace('100000', '100001'), sign(body), secret)).toBe(false);
  });
  it('rejects when the header is missing or empty', () => {
    expect(verifyPaystackSignature(body, undefined, secret)).toBe(false);
    expect(verifyPaystackSignature(body, null, secret)).toBe(false);
    expect(verifyPaystackSignature(body, '', secret)).toBe(false);
  });
  it('rejects a header of a different length without throwing', () => {
    expect(() => verifyPaystackSignature(body, 'abcd', secret)).not.toThrow();
    expect(verifyPaystackSignature(body, 'abcd', secret)).toBe(false);
    expect(verifyPaystackSignature(body, sign(body) + '00', secret)).toBe(false);
  });
  it('rejects non hex text of the right length', () => {
    expect(verifyPaystackSignature(body, 'z'.repeat(128), secret)).toBe(false);
  });
  it('rejects an uppercase hex signature because Paystack sends lowercase', () => {
    expect(verifyPaystackSignature(body, sign(body).toUpperCase(), secret)).toBe(false);
  });
  it('rejects a body that was parsed and serialized again', () => {
    const pretty = JSON.stringify(JSON.parse(body), null, 2);
    expect(verifyPaystackSignature(pretty, sign(body), secret)).toBe(false);
  });
  it('rejects a signature made with a different key (test key against live key)', () => {
    expect(verifyPaystackSignature(body, sign(body, 'sk_test_other'), 'sk_live_secret')).toBe(false);
  });
  it('rejects every call when the secret is empty', () => {
    expect(verifyPaystackSignature(body, sign(body, ''), '')).toBe(false);
  });
  it('uses a constant time comparison', async () => {
    const source = await import('node:fs').then((fs) => fs.readFileSync(new URL('./signature.ts', import.meta.url), 'utf8'));
    expect(source).toContain('timingSafeEqual');
  });
});
