import { describe, expect, it } from 'vitest';
import { PasswordHasher } from './password';

const fast = { memoryKib: 8, timeCost: 1, parallelism: 1 };

describe('PasswordHasher', () => {
  it('produces an argon2id PHC string and verifies the right password', async () => {
    const hasher = new PasswordHasher(fast);
    const hash = await hasher.hash('river-lantern-42-mango');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=8,t=1,p=1\$/);
    expect(await hasher.verify(hash, 'river-lantern-42-mango')).toBe(true);
    expect(await hasher.verify(hash, 'river-lantern-42-mangos')).toBe(false);
  });

  it('uses a fresh salt every time', async () => {
    const hasher = new PasswordHasher(fast);
    expect(await hasher.hash('same password here')).not.toBe(await hasher.hash('same password here'));
  });

  it('returns false for a malformed stored hash instead of throwing', async () => {
    expect(await new PasswordHasher(fast).verify('not-a-hash', 'whatever12345')).toBe(false);
  });

  it('defaults to the SECURITY.md parameters m=19456 t=2 p=1', async () => {
    const hash = await new PasswordHasher().hash('river-lantern-42-mango');
    expect(hash).toContain('m=19456,t=2,p=1');
  });

  it('reports stale parameters so the caller can rehash on login', async () => {
    const old = await new PasswordHasher(fast).hash('river-lantern-42-mango');
    const current = new PasswordHasher({ memoryKib: 16, timeCost: 1, parallelism: 1 });
    expect(current.needsRehash(old)).toBe(true);
    expect(new PasswordHasher(fast).needsRehash(old)).toBe(false);
    expect(current.needsRehash('garbage')).toBe(true);
  });

  it('caps hashing concurrency at two', async () => {
    let running = 0;
    let peak = 0;
    const hasher = new PasswordHasher(fast, {
      concurrency: 2,
      engine: {
        hash: async () => {
          running++;
          peak = Math.max(peak, running);
          await new Promise((resolve) => setTimeout(resolve, 10));
          running--;
          return '$argon2id$v=19$m=8,t=1,p=1$c2FsdA$aGFzaA';
        },
        verify: async () => true,
      },
    });
    await Promise.all(Array.from({ length: 8 }, () => hasher.hash('x'.repeat(12))));
    expect(peak).toBe(2);
  });

  it('verifyDummy spends comparable work and always returns false', async () => {
    const hasher = new PasswordHasher(fast);
    expect(await hasher.verifyDummy('anything at all')).toBe(false);
  });

  it('refuses passwords over the length cap before hashing', async () => {
    await expect(new PasswordHasher(fast).hash('x'.repeat(129))).rejects.toThrow(/too long/i);
  });
});
