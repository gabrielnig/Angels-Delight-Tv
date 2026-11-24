import { schema } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { RateLimited } from '@ad/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountService } from './accounts';
import { MfaCore } from './mfa-core';
import { base32Decode, totpAt } from './totp';
import { createAuthHarness, registerMember, type AuthHarness } from './testing';
import { FieldErrors } from './types';

describe.skipIf(!integrationEnabled())('mfa core shared by staff and viewers', () => {
  let h: AuthHarness;
  let core: MfaCore;
  let accounts: AccountService;
  let failures = 0;
  const onFailure = async () => {
    failures++;
  };

  beforeAll(async () => {
    h = await createAuthHarness();
    accounts = new AccountService(h.deps);
    core = new MfaCore({
      db: h.deps.db,
      keys: h.deps.keys,
      lockouts: h.deps.lockouts,
      pepper: h.deps.pepper,
      now: () => h.deps.clock!(),
    });
  });
  afterAll(async () => {
    await h.drop();
  });

  const codeNow = (secret: string) => totpAt(base32Decode(secret), h.deps.clock!().getTime());

  async function enrolled() {
    const member = await registerMember(h, accounts);
    const begin = await core.beginEnrolment(member.id, 'Test TV', member.email);
    h.advance(31);
    await core.verifyCode(member.id, codeNow(begin.secret), { requireConfirmed: false, onFailure });
    await core.confirm(member.id);
    return { member, secret: begin.secret };
  }

  it('staff and viewer share one verify path: a viewer account verifies through the core', async () => {
    const { member, secret } = await enrolled();
    h.advance(31);
    const result = await core.verifyCode(member.id, codeNow(secret), {
      requireConfirmed: true,
      onFailure,
    });
    expect(result.step).toBeGreaterThan(0);
    expect(await core.isConfirmed(member.id)).toBe(true);
  });

  it('rejects a replayed step', async () => {
    const { member, secret } = await enrolled();
    h.advance(31);
    const code = codeNow(secret);
    await core.verifyCode(member.id, code, { requireConfirmed: true, onFailure });
    await expect(
      core.verifyCode(member.id, code, { requireConfirmed: true, onFailure }),
    ).rejects.toBeInstanceOf(FieldErrors);
  });

  it('refuses an unconfirmed factor when confirmation is required and calls onFailure', async () => {
    const member = await registerMember(h, accounts);
    const begin = await core.beginEnrolment(member.id, 'Test TV', member.email);
    h.advance(31);
    const before = failures;
    await expect(
      core.verifyCode(member.id, codeNow(begin.secret), { requireConfirmed: true, onFailure }),
    ).rejects.toBeInstanceOf(FieldErrors);
    expect(failures).toBe(before + 1);
  });

  it('locks after repeated wrong codes', async () => {
    const { member } = await enrolled();
    for (let i = 0; i < 12; i++) {
      await core
        .verifyCode(member.id, '000000', { requireConfirmed: true, onFailure })
        .catch(() => 0);
    }
    await expect(
      core.verifyCode(member.id, '000000', { requireConfirmed: true, onFailure }),
    ).rejects.toBeInstanceOf(RateLimited);
  });

  it('spends a recovery code once and counts what is left', async () => {
    const { member } = await enrolled();
    const codes = await core.replaceRecoveryCodes(member.id);
    expect(codes).toHaveLength(10);
    const first = await core.claimRecoveryCode(member.id, codes[0]!, { onFailure });
    expect(first.remaining).toBe(9);
    await expect(
      core.claimRecoveryCode(member.id, codes[0]!, { onFailure }),
    ).rejects.toBeInstanceOf(FieldErrors);
    expect(await core.unusedRecoveryCount(member.id)).toBe(9);
  });

  it('removes the factor and every recovery code', async () => {
    const { member } = await enrolled();
    await core.replaceRecoveryCodes(member.id);
    await core.removeAll(member.id);
    expect(await core.isConfirmed(member.id)).toBe(false);
    const rows = await h.dbs.admin.db
      .select()
      .from(schema.mfaRecoveryCodes)
      .where(eq(schema.mfaRecoveryCodes.accountId, member.id));
    expect(rows).toHaveLength(0);
  });
});
