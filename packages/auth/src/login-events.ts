import { schema, withAccount, type Database } from '@ad/db';
import { hmacSha256, type AccountRole } from '@ad/shared';
import { and, desc, eq, isNotNull, lt } from 'drizzle-orm';

/** Days a sign in event is kept (M49-S14). The maintenance job deletes older rows. */
export const LOGIN_EVENT_RETENTION_DAYS = 90;

export type LoginOutcome = 'success' | 'failed' | 'mfa_failed' | 'locked';
export type DeviceKind = 'phone' | 'tablet' | 'tv' | 'computer' | 'other';

export interface LoginEventView {
  id: string;
  at: Date;
  outcome: LoginOutcome;
  /** Two letter country code or null. Never an address. */
  country: string | null;
  newDevice: boolean;
  device: DeviceKind;
  /** A short readable name such as "Chrome on Windows". */
  deviceLabel: string;
}

/** The device cookie value is random and stays on the browser. Only this keyed hash is stored. */
export function deviceHash(pepper: Uint8Array, deviceId: string): Uint8Array {
  return hmacSha256(pepper, `device:${deviceId}`);
}

export function deviceKind(userAgent: string | null): DeviceKind {
  const ua = userAgent ?? '';
  if (/smart-?tv|appletv|hbbtv|crkey|tizen|web0s|roku|aft[a-z]/i.test(ua)) return 'tv';
  if (/ipad|tablet|kindle|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) {
    return 'tablet';
  }
  if (/iphone|ipod|android|mobile/i.test(ua)) return 'phone';
  if (/windows|macintosh|linux|cros/i.test(ua)) return 'computer';
  return 'other';
}

export function deviceLabel(userAgent: string | null): string {
  const ua = userAgent ?? '';
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /opr\/|opera/i.test(ua)
      ? 'Opera'
      : /chrome|crios/i.test(ua)
        ? 'Chrome'
        : /firefox|fxios/i.test(ua)
          ? 'Firefox'
          : /safari/i.test(ua)
            ? 'Safari'
            : 'A browser';
  const system = /android/i.test(ua)
    ? 'Android'
    : /iphone|ipad|ipod/i.test(ua)
      ? 'iOS'
      : /windows/i.test(ua)
        ? 'Windows'
        : /macintosh/i.test(ua)
          ? 'macOS'
          : /cros/i.test(ua)
            ? 'ChromeOS'
            : /linux/i.test(ua)
              ? 'Linux'
              : null;
  return system ? `${browser} on ${system}` : browser;
}

export function countryName(code: string | null): string {
  if (!code) return 'an unknown location';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

export interface RecordLoginInput {
  accountId: string;
  role: AccountRole;
  outcome: LoginOutcome;
  sessionId?: string | null;
  country?: string | null;
  deviceHash?: Uint8Array | null;
  userAgent?: string | null;
  at: Date;
}

/**
 * Writes one event. For a success it also says whether the device is new and whether the account had signed in
 * before, so the caller can decide on the new device email.
 */
export async function recordLoginEvent(
  db: Database,
  input: RecordLoginInput,
): Promise<{ newDevice: boolean; hadEarlierSignIn: boolean }> {
  return withAccount(db, { accountId: input.accountId, role: input.role }, async (tx) => {
    let newDevice = false;
    let hadEarlierSignIn = false;
    if (input.outcome === 'success') {
      const earlier = await tx
        .select({ hash: schema.loginEvents.deviceHash })
        .from(schema.loginEvents)
        .where(
          and(
            eq(schema.loginEvents.accountId, input.accountId),
            eq(schema.loginEvents.outcome, 'success'),
          ),
        );
      hadEarlierSignIn = earlier.length > 0;
      if (input.deviceHash) {
        const mine = Buffer.from(input.deviceHash);
        newDevice = !earlier.some((row) => row.hash && Buffer.from(row.hash).equals(mine));
      }
    }
    await tx.insert(schema.loginEvents).values({
      accountId: input.accountId,
      sessionId: input.sessionId ?? null,
      at: input.at,
      outcome: input.outcome,
      country: input.country ?? null,
      userAgent: input.userAgent ? input.userAgent.slice(0, 200) : null,
      deviceHash: input.deviceHash ? Buffer.from(input.deviceHash) : null,
      newDevice,
    });
    return { newDevice, hadEarlierSignIn };
  });
}

/** Newest first. Runs under row level security, so an account only ever reads its own rows. */
export async function listLoginEvents(
  db: Database,
  accountId: string,
  limit: number,
  role: AccountRole = 'viewer',
): Promise<LoginEventView[]> {
  const rows = await withAccount(db, { accountId, role }, (tx) =>
    tx
      .select()
      .from(schema.loginEvents)
      .where(eq(schema.loginEvents.accountId, accountId))
      .orderBy(desc(schema.loginEvents.at), desc(schema.loginEvents.id))
      .limit(limit),
  );
  return rows.map((row) => ({
    id: row.id,
    at: row.at,
    outcome: row.outcome as LoginOutcome,
    country: row.country,
    newDevice: row.newDevice,
    device: deviceKind(row.userAgent),
    deviceLabel: deviceLabel(row.userAgent),
  }));
}

/** Retention job. Needs a connection that can see every row, such as the maintenance role. */
export async function purgeLoginEvents(
  db: Database,
  now: Date,
  days = LOGIN_EVENT_RETENTION_DAYS,
): Promise<number> {
  const cutoff = new Date(now.getTime() - days * 86_400_000);
  const removed = await db
    .delete(schema.loginEvents)
    .where(and(lt(schema.loginEvents.at, cutoff), isNotNull(schema.loginEvents.accountId)))
    .returning({ id: schema.loginEvents.id });
  return removed.length;
}
