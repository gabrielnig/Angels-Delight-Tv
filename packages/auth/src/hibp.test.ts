import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isPasswordBreached } from './hibp';

const sha1 = (value: string) => createHash('sha1').update(value).digest('hex').toUpperCase();

describe('isPasswordBreached', () => {
  const password = 'correct horse battery staple';
  const hash = sha1(password);

  it('sends only the first five characters of the hash', async () => {
    let requested = '';
    await isPasswordBreached(password, {
      fetch: async (url) => {
        requested = String(url);
        return new Response('');
      },
    });
    expect(requested).toBe(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`);
  });

  it('is true when the suffix appears in the range response', async () => {
    const body = `0000000000000000000000000000000000A:3\r\n${hash.slice(5)}:42\r\nFFFFF:1`;
    expect(await isPasswordBreached(password, { fetch: async () => new Response(body) })).toBe(
      true,
    );
  });

  it('is false when the suffix is absent', async () => {
    expect(
      await isPasswordBreached(password, { fetch: async () => new Response('ABCDEF:1') }),
    ).toBe(false);
  });

  it('ignores padding rows with a zero count', async () => {
    const body = `${hash.slice(5)}:0`;
    expect(await isPasswordBreached(password, { fetch: async () => new Response(body) })).toBe(
      false,
    );
  });

  it('falls back to not breached and logs when the service fails or times out', async () => {
    const warnings: unknown[] = [];
    const failing = await isPasswordBreached(password, {
      fetch: async () => {
        throw new Error('network');
      },
      onUnavailable: (error) => warnings.push(error),
    });
    expect(failing).toBe(false);
    const slow = await isPasswordBreached(password, {
      timeoutMs: 20,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
      onUnavailable: (error) => warnings.push(error),
    });
    expect(slow).toBe(false);
    expect(warnings).toHaveLength(2);
  });

  it('treats a non 200 answer as unavailable', async () => {
    const warnings: unknown[] = [];
    const result = await isPasswordBreached(password, {
      fetch: async () => new Response('', { status: 503 }),
      onUnavailable: (error) => warnings.push(error),
    });
    expect(result).toBe(false);
    expect(warnings).toHaveLength(1);
  });
});
