import { mediaPrefix, uuidv7 } from '@ad/shared';
import { randomBytes } from 'node:crypto';
import type { accounts, profiles, videos } from '../schema';

type AccountInsert = typeof accounts.$inferInsert;
type ProfileInsert = typeof profiles.$inferInsert;
type VideoInsert = typeof videos.$inferInsert;

/** A valid, boring active viewer. Tests state only the fields they care about. */
export function makeAccount(
  overrides: Partial<AccountInsert> = {},
): AccountInsert & { id: string } {
  return {
    id: uuidv7(),
    emailHash: randomBytes(32),
    emailEnc: randomBytes(48),
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$dGVzdHNhbHQ$ZHVtbXloYXNo',
    emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function makeProfile(
  accountId: string,
  overrides: Partial<ProfileInsert> = {},
): ProfileInsert & { id: string } {
  return {
    id: uuidv7(),
    accountId,
    nameEnc: randomBytes(32),
    avatarId: 'sun',
    ...overrides,
  };
}

/** A draft video that is still uploading. Pass status ready with durationMs to publish it. */
export function makeVideo(overrides: Partial<VideoInsert> = {}): VideoInsert & { id: string } {
  const id = uuidv7();
  return {
    id,
    slug: `video-${id.slice(-12)}`,
    title: 'Sample lesson',
    mediaPrefix: mediaPrefix(),
    ...overrides,
  };
}
