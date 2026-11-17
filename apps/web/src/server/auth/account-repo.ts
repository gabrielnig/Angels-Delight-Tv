import { FieldErrors, type SessionService, type StaffService } from '@ad/auth';
import { RateLimited } from '@ad/shared';
import { FixtureAccount } from '../../lib/data/fixtures/account';
import type {
  AccountOverview,
  AccountRepository,
  DeviceSession,
  PlaybackSettings,
} from '../../lib/data/types';
import { deviceLabel, relativeTime } from './devices';
import type { GatewayIo } from './gateway';

type Service = Pick<StaffService, 'getOverview' | 'changePassword' | 'deleteAccount'>;
type Sessions = Pick<SessionService, 'list' | 'revokeOwn' | 'revokeAll'>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function displayNameFrom(email: string): string {
  const local = email.split('@')[0] ?? '';
  const words = local.split(/[._-]+/).filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Member';
}

/**
 * Account area backed by the real auth services. Playback settings and the export request still come from the
 * fixture parent until the viewer data lane supplies them.
 */
export class RealAccountRepository implements AccountRepository {
  private readonly fallback = new FixtureAccount();

  constructor(
    private readonly service: Service,
    private readonly sessions: Sessions,
    private readonly io: GatewayIo,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  playback(profileId: string) {
    return this.fallback.playback(profileId);
  }

  savePlayback(profileId: string, patch: Partial<PlaybackSettings>) {
    return this.fallback.savePlayback(profileId, patch);
  }

  exportState() {
    return this.fallback.exportState();
  }

  requestExport() {
    return this.fallback.requestExport();
  }

  private async actor(accountId: string) {
    const actor = await this.io.currentActor();
    if (!actor || actor.accountId !== accountId) throw new Error('Not signed in as this account');
    return actor;
  }

  async overview(accountId: string): Promise<AccountOverview> {
    const actor = await this.actor(accountId);
    const [info, devices] = await Promise.all([
      this.service.getOverview(actor),
      this.sessions.list(accountId),
    ]);
    const since = info.memberSince;
    return {
      displayName: displayNameFrom(info.email),
      email: info.email,
      verified: info.emailVerified,
      memberSince: `${since.getUTCDate()} ${MONTHS[since.getUTCMonth()]} ${since.getUTCFullYear()}`,
      watchedThisMonth: 0,
      minutesLearning: 0,
      myListCount: 0,
      devices: devices.length,
    };
  }

  async devices(accountId: string): Promise<DeviceSession[]> {
    const actor = await this.actor(accountId);
    const now = this.clock();
    const rows = await this.sessions.list(actor.accountId);
    return rows.map((row) => ({
      id: row.id,
      label: deviceLabel(row.userAgent),
      place: row.ipTrunc ?? 'Location unknown',
      lastActive: relativeTime(row.lastSeenAt, now),
      current: row.id === actor.sessionId,
    }));
  }

  async revokeDevice(accountId: string, id: string): Promise<void> {
    const actor = await this.actor(accountId);
    if (id === actor.sessionId) return;
    await this.sessions.revokeOwn(accountId, id);
  }

  async revokeOtherDevices(accountId: string): Promise<number> {
    const actor = await this.actor(accountId);
    const others = (await this.sessions.list(accountId)).filter((s) => s.id !== actor.sessionId);
    await this.sessions.revokeAll(accountId, { exceptSessionId: actor.sessionId });
    return others.length;
  }

  async changePassword(
    accountId: string,
    input: { current: string; next: string },
  ): ReturnType<AccountRepository['changePassword']> {
    const actor = await this.actor(accountId);
    try {
      const before = (await this.sessions.list(accountId)).filter((s) => s.id !== actor.sessionId);
      const result = await this.service.changePassword(
        actor,
        { currentPassword: input.current, newPassword: input.next },
        await this.io.meta(),
      );
      await this.io.setSession(result.session.token, 'viewer');
      return { ok: true as const, signedOutDevices: before.length };
    } catch (error) {
      if (error instanceof FieldErrors) {
        if (error.fields.currentPassword)
          return { ok: false as const, reason: 'wrong_current' as const };
        return { ok: false as const, reason: 'weak' as const };
      }
      if (error instanceof RateLimited)
        return { ok: false as const, reason: 'wrong_current' as const };
      return { ok: false as const, reason: 'network' as const };
    }
  }

  /** Deletion is immediate: personal data goes and the account key is destroyed (SECURITY.md section 10). */
  async deleteAccount(
    accountId: string,
    input: { password: string; confirm: string },
  ): ReturnType<AccountRepository['deleteAccount']> {
    const actor = await this.actor(accountId);
    try {
      await this.service.deleteAccount(
        actor,
        { password: input.password, confirmation: input.confirm },
        await this.io.meta(),
      );
      await this.io.clearSession();
      return { ok: true as const, days: 0 };
    } catch (error) {
      if (error instanceof FieldErrors) {
        if (error.fields.confirmation) return { ok: false as const, reason: 'confirm' as const };
        return { ok: false as const, reason: 'wrong_password' as const };
      }
      if (error instanceof RateLimited)
        return { ok: false as const, reason: 'wrong_password' as const };
      return { ok: false as const, reason: 'network' as const };
    }
  }
}
