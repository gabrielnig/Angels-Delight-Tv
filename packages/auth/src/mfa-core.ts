import { schema, type Database } from '@ad/db';
import { LimiterUnavailable, LOCKOUT_POLICIES, type LockoutStore } from '@ad/security';
import { RateLimited } from '@ad/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { KeyService } from './keys';
import {
  base32Decode,
  base32Encode,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  otpauthUri,
  qrSvg,
  verifyTotp,
} from './totp';
import { FieldErrors } from './types';

export interface MfaCoreDeps {
  db: Database;
  keys: KeyService;
  lockouts: LockoutStore;
  pepper: Uint8Array;
  now: () => Date;
}

export interface MfaFailureHook {
  /** Called once for every wrong code, after the lockout counter moved. Writes the caller's own audit entry. */
  onFailure: () => Promise<void>;
  /** Field name in the returned FieldErrors. Defaults to `code`. */
  field?: string;
}

/**
 * The second factor mechanics shared by staff and viewers: TOTP check with lockout, one step of drift and replay
 * protection, enrolment, and single use recovery codes. It knows nothing about roles or sessions, so each service
 * keeps its own rules, audit names and session handling around it.
 */
export class MfaCore {
  constructor(private readonly deps: MfaCoreDeps) {}

  /** Limiter and lockout stores fail closed on auth routes (M23-S03 AC2). */
  private async closed<T>(task: () => Promise<T>): Promise<T> {
    try {
      return await task();
    } catch (error) {
      if (error instanceof RateLimited || error instanceof LimiterUnavailable) throw error;
      throw new LimiterUnavailable({ cause: error });
    }
  }

  lockKey(accountId: string): string {
    return `mfa:${accountId}`;
  }

  async lockCheck(accountId: string): Promise<void> {
    const lock = await this.closed(() => this.deps.lockouts.status(this.lockKey(accountId)));
    if (lock.locked) throw new RateLimited(lock.retryAfterSeconds);
  }

  /** Counts one wrong code of any kind toward the shared lockout, runs the caller's audit and throws. */
  async failWrongCode(accountId: string, hook: MfaFailureHook & { message?: string }): Promise<never> {
    await this.closed(() =>
      this.deps.lockouts.registerFailure(this.lockKey(accountId), LOCKOUT_POLICIES.mfaCode),
    );
    await hook.onFailure();
    throw new FieldErrors({ [hook.field ?? 'code']: hook.message ?? 'That code is not right' });
  }

  async clearFailures(accountId: string): Promise<void> {
    await this.closed(() => this.deps.lockouts.clear(this.lockKey(accountId)));
  }

  private async fail(accountId: string, hook: MfaFailureHook): Promise<never> {
    await this.closed(() =>
      this.deps.lockouts.registerFailure(this.lockKey(accountId), LOCKOUT_POLICIES.mfaCode),
    );
    await hook.onFailure();
    throw new FieldErrors({ [hook.field ?? 'code']: 'That code is not right' });
  }

  async isConfirmed(accountId: string): Promise<boolean> {
    const [factor] = await this.deps.db
      .select({ confirmedAt: schema.mfaFactors.confirmedAt })
      .from(schema.mfaFactors)
      .where(eq(schema.mfaFactors.accountId, accountId));
    return Boolean(factor?.confirmedAt);
  }

  /** Checks an authenticator code, with lockout, one step of drift and replay protection. */
  async verifyCode(
    accountId: string,
    code: string,
    options: MfaFailureHook & { requireConfirmed: boolean },
  ): Promise<{ factorId: string; step: number }> {
    await this.lockCheck(accountId);
    const [factor] = await this.deps.db
      .select()
      .from(schema.mfaFactors)
      .where(eq(schema.mfaFactors.accountId, accountId));
    if (!factor || (options.requireConfirmed && !factor.confirmedAt)) {
      return this.fail(accountId, options);
    }
    const secret = base32Decode(
      await this.deps.keys.open(accountId, 'totp_secret', factor.secretEnc),
    );
    const result = verifyTotp(secret, code, this.deps.now().getTime(), {
      lastUsedStep: factor.lastUsedStep,
    });
    if (!result.ok) return this.fail(accountId, options);
    const claimed = await this.deps.db
      .update(schema.mfaFactors)
      .set({ lastUsedStep: result.step })
      .where(
        and(
          eq(schema.mfaFactors.id, factor.id),
          sql`(${schema.mfaFactors.lastUsedStep} IS NULL OR ${schema.mfaFactors.lastUsedStep} < ${result.step})`,
        ),
      )
      .returning({ id: schema.mfaFactors.id });
    if (claimed.length === 0) return this.fail(accountId, options);
    await this.closed(() => this.deps.lockouts.clear(this.lockKey(accountId)));
    return { factorId: factor.id, step: result.step };
  }

  /** Replaces any unconfirmed or old factor with a fresh sealed secret. The caller refuses when one is confirmed. */
  async beginEnrolment(
    accountId: string,
    issuer: string,
    accountLabel: string,
  ): Promise<{ secret: string; uri: string; qrSvg: string }> {
    const secret = generateTotpSecret();
    const base32 = base32Encode(secret);
    const secretEnc = await this.deps.keys.seal(accountId, 'totp_secret', base32);
    await this.deps.db.delete(schema.mfaFactors).where(eq(schema.mfaFactors.accountId, accountId));
    await this.deps.db.insert(schema.mfaFactors).values({ accountId, type: 'totp', secretEnc });
    const uri = otpauthUri({ secret, account: accountLabel, issuer });
    return { secret: base32, uri, qrSvg: await qrSvg(uri) };
  }

  async confirm(accountId: string): Promise<void> {
    await this.deps.db
      .update(schema.mfaFactors)
      .set({ confirmedAt: this.deps.now() })
      .where(eq(schema.mfaFactors.accountId, accountId));
  }

  async replaceRecoveryCodes(accountId: string): Promise<string[]> {
    const codes = generateRecoveryCodes(10);
    await this.deps.db
      .delete(schema.mfaRecoveryCodes)
      .where(eq(schema.mfaRecoveryCodes.accountId, accountId));
    await this.deps.db.insert(schema.mfaRecoveryCodes).values(
      codes.map((code) => ({
        accountId,
        codeHash: Buffer.from(hashRecoveryCode(this.deps.pepper, code)),
      })),
    );
    return codes;
  }

  async unusedRecoveryCount(accountId: string): Promise<number> {
    const rows = await this.deps.db
      .select({ id: schema.mfaRecoveryCodes.id })
      .from(schema.mfaRecoveryCodes)
      .where(
        and(
          eq(schema.mfaRecoveryCodes.accountId, accountId),
          isNull(schema.mfaRecoveryCodes.usedAt),
        ),
      );
    return rows.length;
  }

  /** Spends one recovery code. Wrong, malformed and already spent codes all count toward the lockout. */
  async claimRecoveryCode(
    accountId: string,
    input: string,
    hook: MfaFailureHook,
  ): Promise<{ remaining: number }> {
    await this.lockCheck(accountId);
    const code = normalizeRecoveryCode(input);
    const claimed = code
      ? await this.deps.db
          .update(schema.mfaRecoveryCodes)
          .set({ usedAt: this.deps.now() })
          .where(
            and(
              eq(schema.mfaRecoveryCodes.accountId, accountId),
              eq(
                schema.mfaRecoveryCodes.codeHash,
                Buffer.from(hashRecoveryCode(this.deps.pepper, code)),
              ),
              isNull(schema.mfaRecoveryCodes.usedAt),
            ),
          )
          .returning({ id: schema.mfaRecoveryCodes.id })
      : [];
    if (claimed.length === 0) return this.fail(accountId, hook);
    await this.closed(() => this.deps.lockouts.clear(this.lockKey(accountId)));
    return { remaining: await this.unusedRecoveryCount(accountId) };
  }

  async removeAll(accountId: string): Promise<void> {
    await this.deps.db.delete(schema.mfaFactors).where(eq(schema.mfaFactors.accountId, accountId));
    await this.deps.db
      .delete(schema.mfaRecoveryCodes)
      .where(eq(schema.mfaRecoveryCodes.accountId, accountId));
  }
}
