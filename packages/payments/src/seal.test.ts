import { describe, expect, it } from 'vitest';
import { openPayload, sealPayload } from './seal';

const key = new Uint8Array(32).fill(9);

describe('payload sealing', () => {
  it('round trips and hides the text', async () => {
    const body = new TextEncoder().encode('{"email":"donor@example.com"}');
    const sealed = await sealPayload(key)(body);
    expect(Buffer.from(sealed).toString('utf8')).not.toContain('donor@example.com');
    expect(new TextDecoder().decode(await openPayload(key)(sealed))).toBe('{"email":"donor@example.com"}');
  });
  it('does not open with another key', async () => {
    const sealed = await sealPayload(key)(new TextEncoder().encode('x'));
    await expect(openPayload(new Uint8Array(32).fill(1))(sealed)).rejects.toThrow();
  });
  it('seals the same text differently each time', async () => {
    const body = new TextEncoder().encode('same');
    const a = await sealPayload(key)(body);
    const b = await sealPayload(key)(body);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });
});
