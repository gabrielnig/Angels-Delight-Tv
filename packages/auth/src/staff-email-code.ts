import { schema, type Database } from '@ad/db';
import { MailDeliveryError } from '@ad/mailer';
import { RateLimited, type TokenPurpose } from '@ad/shared';
import { RATE_POLICIES, type RateLimiter } from '@ad/security';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { checkCode, issueEmailToken } from './email-tokens';
import { countryName, deviceLabel } from './login-events';
import type { AuthConfig, RequestMeta } from './types';

export type StaffCodePurpose = Extract<TokenPurpose, 'staff_sign_in' | 'staff_confirm'>;
export type StaffCodeCheck = 'ok' | 'invalid' | 'expired' | 'too_many';

export interface StaffCodeContext {
  db: Database;
  limiter: RateLimiter;
  pepper: Uint8Array;
  cfg: AuthConfig;
  now: () => Date;
  /** Keyed, opaque rate limit subject for a kind of value (never a raw address). */
  subject: (kind: string, value: string) => string;
  /** Sends the mail. Throws MailDeliveryError when the provider refuses it. */
  send: (mail: {
    code: string;
    minutes: number;
    device: string;
    place: string;
    time: string;
  }) => Promise<unknown>;
}

/** Coarse words for the mail: the browser, the country and the UTC time. No address of any kind (D-397). */
export function codeMailContext(meta: RequestMeta, now: Date) {
  return {
    device: deviceLabel(meta.userAgent),
    place: countryName(meta.country ?? null),
    time: `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
  };
}

/**
 * Mails a fresh six digit code. A resend is refused for 60 seconds, then limited per account and per network (keyed
 * hash). The code is hashed in `verification_codes`, expires with its token, and replacing it voids the old one.
 * Returns false when the mail could not be sent; the unusable code is voided so the person can ask again at once.
 */
export async function sendStaffCode(
  ctx: StaffCodeContext,
  input: { accountId: string; purpose: StaffCodePurpose; meta: RequestMeta },
): Promise<{ sent: boolean }> {
  const now = ctx.now();
  const [latest] = await ctx.db
    .select({ createdAt: schema.emailTokens.createdAt })
    .from(schema.emailTokens)
    .where(
      and(
        eq(schema.emailTokens.accountId, input.accountId),
        eq(schema.emailTokens.purpose, input.purpose),
        isNull(schema.emailTokens.usedAt),
      ),
    )
    .orderBy(desc(schema.emailTokens.createdAt))
    .limit(1);
  if (latest) {
    const waitMs = latest.createdAt.getTime() + ctx.cfg.staffCodeResendCooldownSeconds * 1000 - now.getTime();
    if (waitMs > 0) throw new RateLimited(Math.ceil(waitMs / 1000));
  }
  await ctx.limiter.enforce(
    RATE_POLICIES.staffCodeSendAccount,
    ctx.subject('staff-code', input.accountId),
  );
  await ctx.limiter.enforce(
    RATE_POLICIES.staffCodeSendNetwork,
    ctx.subject('ip', input.meta.ip ?? 'unknown'),
  );
  const issued = await issueEmailToken(ctx.db, {
    accountId: input.accountId,
    purpose: input.purpose,
    ttlSeconds: ctx.cfg.staffCodeTtlSeconds,
    withCode: true,
    ipTrunc: input.meta.ipTrunc,
    now,
    pepper: ctx.pepper,
  });
  try {
    await ctx.send({
      code: issued.code!,
      minutes: Math.round(ctx.cfg.staffCodeTtlSeconds / 60),
      ...codeMailContext(input.meta, now),
    });
    return { sent: true };
  } catch (error) {
    if (!(error instanceof MailDeliveryError)) throw error;
    await ctx.db
      .update(schema.emailTokens)
      .set({ usedAt: now })
      .where(eq(schema.emailTokens.id, issued.id));
    return { sent: false };
  }
}

/** Checks a code and, when right, spends it in the same step so it works exactly once. */
export async function checkStaffCode(
  ctx: Pick<StaffCodeContext, 'db' | 'pepper' | 'cfg' | 'now'>,
  input: { accountId: string; purpose: StaffCodePurpose; code: string },
): Promise<StaffCodeCheck> {
  const now = ctx.now();
  const check = await checkCode(ctx.db, {
    accountId: input.accountId,
    purpose: input.purpose,
    code: input.code,
    now,
    ttlSeconds: ctx.cfg.staffCodeTtlSeconds,
    maxAttempts: ctx.cfg.staffCodeMaxAttempts,
    pepper: ctx.pepper,
  });
  if (check.status !== 'ok') return check.status;
  const spent = await ctx.db
    .update(schema.emailTokens)
    .set({ usedAt: now })
    .where(and(eq(schema.emailTokens.id, check.token.id), isNull(schema.emailTokens.usedAt)))
    .returning({ id: schema.emailTokens.id });
  return spent.length > 0 ? 'ok' : 'invalid';
}
