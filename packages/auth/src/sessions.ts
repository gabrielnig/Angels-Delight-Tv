import { schema, withAccount, type Database } from '@ad/db';
import type { AccountRole, AccountStatus } from '@ad/shared';
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { generateToken, hashToken } from './tokens';

export interface SessionPolicy {
  idleSeconds: number;
  absoluteSeconds: number;
}

/** SECURITY.md section 4 for viewers. Staff use the stricter M12-S01 values (30 minutes idle, 8 hours absolute). */
export const DEFAULT_SESSION_POLICIES = {
  viewer: { idleSeconds: 30 * 86400, absoluteSeconds: 90 * 86400 },
  staff: { idleSeconds: 30 * 60, absoluteSeconds: 8 * 3600 },
  pendingMfa: { idleSeconds: 10 * 60, absoluteSeconds: 10 * 60 },
} as const satisfies Record<string, SessionPolicy>;

export type SessionKind = 'viewer' | 'staff' | 'pending_mfa';

export interface SessionContext {
  sessionId: string;
  accountId: string;
  role: AccountRole;
  status: AccountStatus;
  emailVerified: boolean;
  /** True only for a session that passed the second factor (an admin session). */
  mfaVerified: boolean;
  reauthAt: Date | null;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  /** Server side profile choice. Authoritative while `kidsLocked` is true. */
  activeProfileId: string | null;
  kidsLocked: boolean;
}

export type SessionEnd = 'unknown' | 'revoked' | 'expired' | 'unavailable';

export interface SessionServiceOptions {
  clock?: () => Date;
  policies?: typeof DEFAULT_SESSION_POLICIES;
  /** Minimum gap between last_seen writes. */
  touchIntervalSeconds?: number;
}

export interface CreateSessionInput {
  accountId: string;
  kind: SessionKind;
  ipTrunc?: string | null;
  userAgent?: string | null;
  country?: string | null;
  deviceHash?: Uint8Array | null;
}

export interface SessionListItem {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  ipTrunc: string | null;
  userAgent: string | null;
  country: string | null;
  mfaVerified: boolean;
}

const MAX_TOKEN_LENGTH = 64;

/** Opaque, database backed sessions. Only the SHA-256 of the cookie token is stored. */
export class SessionService {
  private readonly clock: () => Date;
  private readonly policies: typeof DEFAULT_SESSION_POLICIES;
  private readonly touchInterval: number;

  constructor(
    private readonly db: Database,
    options: SessionServiceOptions = {},
  ) {
    this.clock = options.clock ?? (() => new Date());
    this.policies = options.policies ?? DEFAULT_SESSION_POLICIES;
    this.touchInterval = (options.touchIntervalSeconds ?? 60) * 1000;
  }

  policyFor(kind: SessionKind): SessionPolicy {
    return kind === 'viewer'
      ? this.policies.viewer
      : kind === 'staff'
        ? this.policies.staff
        : this.policies.pendingMfa;
  }

  async create(input: CreateSessionInput): Promise<{ token: string; session: { id: string } }> {
    const token = generateToken();
    const now = this.clock();
    const policy = this.policyFor(input.kind);
    const absolute = new Date(now.getTime() + policy.absoluteSeconds * 1000);
    const idle = new Date(Math.min(now.getTime() + policy.idleSeconds * 1000, absolute.getTime()));
    const [row] = await this.db
      .insert(schema.sessions)
      .values({
        accountId: input.accountId,
        tokenHash: Buffer.from(hashToken(token)),
        createdAt: now,
        lastSeenAt: now,
        idleExpiresAt: idle,
        absoluteExpiresAt: absolute,
        mfaVerifiedAt: input.kind === 'staff' ? now : null,
        ipTrunc: input.ipTrunc ?? null,
        userAgent: input.userAgent ? input.userAgent.slice(0, 200) : null,
        country: input.country ?? null,
        deviceHash: input.deviceHash ? Buffer.from(input.deviceHash) : null,
      })
      .returning({ id: schema.sessions.id });
    if (!row) throw new Error('Session insert returned no row');
    return { token, session: { id: row.id } };
  }

  async validate(token: string): Promise<SessionContext | null> {
    return (await this.inspect(token)).context ?? null;
  }

  /** Like validate, but says why a session ended so the UI can explain it (M01-S12 AC3). */
  async inspect(token: string): Promise<{ context?: SessionContext; ended?: SessionEnd }> {
    if (!token || token.length > MAX_TOKEN_LENGTH) return { ended: 'unknown' };
    const [session] = await this.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.tokenHash, Buffer.from(hashToken(token))));
    if (!session) return { ended: 'unknown' };
    const now = this.clock();
    if (session.revokedAt) return { ended: 'revoked' };
    if (session.idleExpiresAt <= now || session.absoluteExpiresAt <= now)
      return { ended: 'expired' };

    const account = await withAccount(
      this.db,
      { accountId: session.accountId, role: 'viewer' },
      async (tx) => {
        const [row] = await tx
          .select({
            role: schema.accounts.role,
            status: schema.accounts.status,
            emailVerifiedAt: schema.accounts.emailVerifiedAt,
          })
          .from(schema.accounts)
          .where(eq(schema.accounts.id, session.accountId));
        return row;
      },
    );
    if (!account || (account.status !== 'active' && account.status !== 'pending_deletion')) {
      if (account?.status === 'suspended') await this.revoke(session.id);
      return { ended: 'unavailable' };
    }

    let { idleExpiresAt } = session;
    let { lastSeenAt } = session;
    if (now.getTime() - session.lastSeenAt.getTime() >= this.touchInterval) {
      const kind: SessionKind = session.mfaVerifiedAt ? 'staff' : 'viewer';
      const idleSeconds = this.policyFor(kind).idleSeconds;
      idleExpiresAt = new Date(
        Math.min(now.getTime() + idleSeconds * 1000, session.absoluteExpiresAt.getTime()),
      );
      lastSeenAt = now;
      await this.db
        .update(schema.sessions)
        .set({ lastSeenAt, idleExpiresAt })
        .where(eq(schema.sessions.id, session.id));
    }
    return {
      context: {
        sessionId: session.id,
        accountId: session.accountId,
        role: account.role,
        status: account.status,
        emailVerified: account.emailVerifiedAt !== null,
        mfaVerified: session.mfaVerifiedAt !== null,
        reauthAt: session.reauthAt,
        activeProfileId: session.activeProfileId,
        kidsLocked: session.kidsLocked,
        idleExpiresAt,
        absoluteExpiresAt: session.absoluteExpiresAt,
      },
    };
  }

  /** After the second factor: ends the pending session and starts a staff session with a new token. */
  async promoteToStaff(
    pendingSessionId: string,
  ): Promise<{ token: string; session: { id: string } }> {
    const [pending] = await this.db
      .select()
      .from(schema.sessions)
      .where(and(eq(schema.sessions.id, pendingSessionId), isNull(schema.sessions.revokedAt)));
    if (!pending) throw new Error('Session to promote not found');
    await this.revoke(pendingSessionId);
    const next = await this.create({
      accountId: pending.accountId,
      kind: 'staff',
      ipTrunc: pending.ipTrunc,
      userAgent: pending.userAgent,
    });
    await this.markReauth(next.session.id);
    return next;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.db
      .update(schema.sessions)
      .set({ revokedAt: this.clock() })
      .where(and(eq(schema.sessions.id, sessionId), isNull(schema.sessions.revokedAt)));
  }

  async revokeByToken(token: string): Promise<void> {
    if (!token || token.length > MAX_TOKEN_LENGTH) return;
    await this.db
      .update(schema.sessions)
      .set({ revokedAt: this.clock() })
      .where(
        and(
          eq(schema.sessions.tokenHash, Buffer.from(hashToken(token))),
          isNull(schema.sessions.revokedAt),
        ),
      );
  }

  async revokeAll(accountId: string, options: { exceptSessionId?: string } = {}): Promise<void> {
    const conditions = [
      eq(schema.sessions.accountId, accountId),
      isNull(schema.sessions.revokedAt),
    ];
    if (options.exceptSessionId) conditions.push(ne(schema.sessions.id, options.exceptSessionId));
    await this.db
      .update(schema.sessions)
      .set({ revokedAt: this.clock() })
      .where(and(...conditions));
  }

  /** Revokes one session if it belongs to the account. Returns false for someone else's session id. */
  async revokeOwn(accountId: string, sessionId: string): Promise<boolean> {
    const rows = await this.db
      .update(schema.sessions)
      .set({ revokedAt: this.clock() })
      .where(
        and(
          eq(schema.sessions.id, sessionId),
          eq(schema.sessions.accountId, accountId),
          isNull(schema.sessions.revokedAt),
        ),
      )
      .returning({ id: schema.sessions.id });
    return rows.length > 0;
  }

  /**
   * Records which profile this session uses and whether a kids profile locks it. The profile must belong to the
   * account (checked under row level security), so a forged id cannot be stored.
   */
  async setProfile(
    sessionId: string,
    accountId: string,
    profileId: string,
    kidsLocked: boolean,
  ): Promise<void> {
    const updated = await withAccount(this.db, { accountId, role: 'viewer' }, (tx) =>
      tx
        .update(schema.sessions)
        .set({ activeProfileId: profileId, kidsLocked })
        .where(
          and(
            eq(schema.sessions.id, sessionId),
            eq(schema.sessions.accountId, accountId),
            isNull(schema.sessions.revokedAt),
            sql`EXISTS (SELECT 1 FROM profiles p WHERE p.id = ${profileId}::uuid AND p.account_id = ${accountId}::uuid)`,
          ),
        )
        .returning({ id: schema.sessions.id }),
    );
    if (updated.length === 0) throw new Error('Profile could not be set on this session');
  }

  /** Exit kids mode: the caller has already checked the account password. */
  async clearKidsLock(sessionId: string, accountId: string): Promise<void> {
    await this.db
      .update(schema.sessions)
      .set({ activeProfileId: null, kidsLocked: false })
      .where(and(eq(schema.sessions.id, sessionId), eq(schema.sessions.accountId, accountId)));
  }

  async markReauth(sessionId: string): Promise<void> {
    await this.db
      .update(schema.sessions)
      .set({ reauthAt: this.clock() })
      .where(eq(schema.sessions.id, sessionId));
  }

  async list(accountId: string): Promise<SessionListItem[]> {
    const now = this.clock();
    const rows = await this.db
      .select()
      .from(schema.sessions)
      .where(and(eq(schema.sessions.accountId, accountId), isNull(schema.sessions.revokedAt)))
      .orderBy(desc(schema.sessions.lastSeenAt));
    return rows
      .filter((row) => row.idleExpiresAt > now && row.absoluteExpiresAt > now)
      .map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        lastSeenAt: row.lastSeenAt,
        ipTrunc: row.ipTrunc,
        userAgent: row.userAgent,
        country: row.country,
        mfaVerified: row.mfaVerifiedAt !== null,
      }));
  }
}
