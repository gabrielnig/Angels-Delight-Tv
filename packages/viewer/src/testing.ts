import { createAesNameCipher } from './name-cipher';
import type { ViewerContext } from './context';
import {
  NOW,
  createViewerTestDb,
  seedAccount,
  seedProfile,
  type ViewerTestDb,
} from '@ad/catalog/testing';
import type { Actor } from '@ad/shared';

export * from '@ad/catalog/testing';

export const TEST_PASSWORD = 'correct horse battery staple';

export interface ViewerHarness {
  db: ViewerTestDb;
  ctx: ViewerContext;
  /** An account with an adult primary profile, ready to use. */
  makeUser(
    role?: Actor['role'],
  ): Promise<{ actor: Actor; accountId: string; profileId: string; kidsProfileId: string }>;
  /** Replaces the clock the services use. */
  setNow(value: Date): void;
  drop(): Promise<void>;
}

export async function createHarness(
  overrides: Partial<ViewerContext> = {},
): Promise<ViewerHarness> {
  const db = await createViewerTestDb();
  let now = NOW;
  const ctx: ViewerContext = {
    db: db.app,
    mediaOrigin: 'https://media.test',
    nameCipher: createAesNameCipher(new Uint8Array(32).fill(7)),
    verifyPassword: async (_accountId, password) => password === TEST_PASSWORD,
    now: () => now,
    ...overrides,
  };
  return {
    db,
    ctx,
    setNow(value) {
      now = value;
    },
    async makeUser(role = 'viewer') {
      const account = await seedAccount(db.setup, role);
      const adult = await seedProfile(db.setup, account.id, {
        isPrimary: true,
        nameEnc: Buffer.from(await ctx.nameCipher.seal(account.id, 'Grown up')),
        position: 0,
      });
      const kids = await seedProfile(db.setup, account.id, {
        isKids: true,
        nameEnc: Buffer.from(await ctx.nameCipher.seal(account.id, 'Little one')),
        position: 1,
      });
      return {
        actor: { accountId: account.id, role },
        accountId: account.id,
        profileId: adult.id,
        kidsProfileId: kids.id,
      };
    },
    drop: () => db.drop(),
  };
}
