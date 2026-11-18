import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assets } from './schema';
import { createTestDatabase, integrationEnabled, type TestDatabase } from './testing';

describe.skipIf(!integrationEnabled())(
  'asset blur placeholder and frame score (migration 0034)',
  () => {
    let t: TestDatabase;
    beforeAll(async () => {
      t = await createTestDatabase();
    });
    afterAll(async () => {
      await t?.drop();
    });

    const base = {
      purpose: 'thumbnail' as const,
      status: 'processing' as const,
      mime: 'image/webp',
    };

    it('stores a blur placeholder under 1 KB and a score from 0 to 100, and both may be empty', async () => {
      await t.db.insert(assets).values({ ...base });
      await t.db
        .insert(assets)
        .values({ ...base, placeholderBlur: 'data:image/webp;base64,AAAA', candidateScore: 0 });
      await t.db.insert(assets).values({ ...base, candidateScore: 100 });
    });

    it('refuses a blur placeholder of 1 KB or more', async () => {
      await expect(
        t.db.insert(assets).values({ ...base, placeholderBlur: 'x'.repeat(1024) }),
      ).rejects.toThrow();
      await t.db.insert(assets).values({ ...base, placeholderBlur: 'x'.repeat(1023) });
    });

    it('refuses a score outside 0 to 100', async () => {
      await expect(t.db.insert(assets).values({ ...base, candidateScore: 101 })).rejects.toThrow();
      await expect(t.db.insert(assets).values({ ...base, candidateScore: -1 })).rejects.toThrow();
    });
  },
);
