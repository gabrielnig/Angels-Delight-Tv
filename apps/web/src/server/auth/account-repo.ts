import { FieldErrors, type SessionService, type StaffService } from '@ad/auth';
import { RateLimited } from '@ad/shared';
import { FixtureAccount } from '../../lib/data/fixtures/account';
import type {
  AccountOverview,
  AccountRepository,
  DeviceSession,
  ExportState,
  PlaybackSettings,
} from '../../lib/data/types';
import { deviceLabel, relativeTime } from './devices';
import type { GatewayIo } from './gateway';

type Service = Pick<
  StaffService,
  | 'getOverview'
  | 'changePassword'
  | 'deleteAccount'
  | 'getDeletionState'
  | 'cancelDeletion'
  | 'setDisplayName'
  | 'requestEmailChange'
  | 'confirmEmailChange'
>;
type Sessions = Pick<SessionService, 'list' | 'revokeOwn' | 'revokeAll'>;

/** The viewer side of the account area (stats, playback settings, export). Implemented by AccountViewerData. */
export interface AccountViewerSource {
  stats(
    accountId: string,
  ): Promise<{ watchedThisMonth: number; minutesLearning: number; myListCount: number }>;
  playback(accountId: string, profileId: string): Promise<PlaybackSettings>;
  savePlayback(
    accountId: string,
    profileId: string,
    patch: Partial<PlaybackSettings>,
  ): Promise<PlaybackSettings>;
  migrateDevicePlayback(
    accountId: string,
    profileId: string,
    legacy: Record<string, unknown>,
  ): Promise<PlaybackSettings>;
  /** The background export job (M02-S05). */
  exports: {
    request(
      accountId: string,
      password: string,
    ): Promise<{ status: 'started' | 'already' | 'wrong_password' }>;
    state(accountId: string): Promise<ExportState>;
    /** Starts the job without waiting for it. */
    kick(): void;
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function daysUntil(date: Date, now: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 86400_000));
}

function formatDay(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function displayNameFrom(email: string): string {
  const local = email.split('@')[0] ?? '';
  const words = local.split(/[._-]+/).filter(Boolean);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Member';
}

/**
 * Account area backed by the real auth services. Stats, playback settings and the export come from the viewer
 * data when it is given. Without it (unit tests, fixture mode) the fixture parent answers those.
 */
export class RealAccountRepository implements AccountRepository {
  private readonly fallback = new FixtureAccount();

  constructor(
    private readonly service: Service,
    private readonly sessions: Sessions,
    private readonly io: GatewayIo,
    private readonly clock: () => Date = () => new Date(),
    private readonly viewer?: AccountViewerSource,
  ) {}

  private async signedInAccount(): Promise<string> {
    const actor = await this.io.currentActor();
    if (!actor) throw new Error('Not signed in');
    return actor.accountId;
  }

  async playback(profileId: string) {
    if (!this.viewer) return this.fallback.playback(profileId);
    return this.viewer.playback(await this.signedInAccount(), profileId);
  }

  async savePlayback(profileId: string, patch: Partial<PlaybackSettings>) {
    if (!this.viewer) return this.fallback.savePlayback(profileId, patch);
    return this.viewer.savePlayback(await this.signedInAccount(), profileId, patch);
  }

  async migrateDevicePlayback(profileId: string, legacy: Record<string, unknown>) {
    if (!this.viewer) return this.fallback.migrateDevicePlayback(profileId, legacy);
    return this.viewer.migrateDevicePlayback(await this.signedInAccount(), profileId, legacy);
  }

  /** The latest export request: none, being built, ready with a 24 hour link, or failed (S30 states 1 to 4). */
  async exportState(accountId?: string): Promise<ExportState> {
    if (!this.viewer) return this.fallback.exportState();
    return this.viewer.exports.state(accountId ?? (await this.signedInAccount()));
  }

  /** Needs the account password. Starts the background job, which mails the link (M02-S05). */
  async requestExport(
    accountId: string,
    input: { password: string },
  ): ReturnType<AccountRepository['requestExport']> {
    if (!this.viewer) return this.fallback.requestExport(accountId, input);
    try {
      await this.actor(accountId);
      const result = await this.viewer.exports.request(accountId, input.password);
      if (result.status === 'wrong_password')
        return { ok: false as const, reason: 'wrong_password' as const };
      if (result.status === 'started') this.viewer.exports.kick();
      return {
        ok: true as const,
        already: result.status === 'already',
        state: await this.viewer.exports.state(accountId),
      };
    } catch {
      return { ok: false as const, reason: 'network' as const };
    }
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
    const stats = this.viewer
      ? await this.viewer.stats(accountId)
      : { watchedThisMonth: 0, minutesLearning: 0, myListCount: 0 };
    return {
      displayName: info.displayName ?? displayNameFrom(info.email),
      email: info.email,
      verified: info.emailVerified,
      memberSince: `${since.getUTCDate()} ${MONTHS[since.getUTCMonth()]} ${since.getUTCFullYear()}`,
      ...stats,
      devices: devices.length,
      passwordChanged: formatDay(info.passwordChangedAt),
    };
  }

  async updateName(accountId: string, name: string): ReturnType<AccountRepository['updateName']> {
    const actor = await this.actor(accountId);
    try {
      const saved = await this.service.setDisplayName(actor, { name }, await this.io.meta());
      return { ok: true as const, name: saved };
    } catch (error) {
      if (error instanceof FieldErrors) return { ok: false as const, reason: 'invalid' as const };
      return { ok: false as const, reason: 'network' as const };
    }
  }

  async requestEmailChange(
    accountId: string,
    input: { newEmail: string; password: string },
  ): ReturnType<AccountRepository['requestEmailChange']> {
    const actor = await this.actor(accountId);
    try {
      const result = await this.service.requestEmailChange(actor, input, await this.io.meta());
      return { ok: true as const, pendingEmail: result.pendingEmail };
    } catch (error) {
      if (error instanceof FieldErrors) {
        if (error.fields.password) return { ok: false as const, reason: 'wrong_password' as const };
        if (error.fields.newEmail === 'That is already your email')
          return { ok: false as const, reason: 'same_email' as const };
        return { ok: false as const, reason: 'invalid_email' as const };
      }
      if (error instanceof RateLimited)
        return { ok: false as const, reason: 'wrong_password' as const };
      return { ok: false as const, reason: 'network' as const };
    }
  }

  async confirmEmailChange(
    accountId: string,
    input: { code: string },
  ): ReturnType<AccountRepository['confirmEmailChange']> {
    const actor = await this.actor(accountId);
    try {
      const result = await this.service.confirmEmailChange(actor, input, await this.io.meta());
      return result.status === 'changed'
        ? { ok: true as const }
        : { ok: false as const, reason: result.status };
    } catch {
      return { ok: false as const, reason: 'network' as const };
    }
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

  /** Deletion starts a grace period: the account closes, every session ends and the owner can cancel by signing in. */
  async deleteAccount(
    accountId: string,
    input: { password: string; confirm: string },
  ): ReturnType<AccountRepository['deleteAccount']> {
    const actor = await this.actor(accountId);
    try {
      const { purgeAfter } = await this.service.deleteAccount(
        actor,
        { password: input.password, confirmation: input.confirm },
        await this.io.meta(),
      );
      await this.io.clearSession();
      return { ok: true as const, days: daysUntil(purgeAfter, this.clock()) };
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

  async deletionState(_accountId?: string): ReturnType<AccountRepository['deletionState']> {
    const actor = await this.io.pendingDeletionActor();
    if (!actor) return { pending: false };
    const state = await this.service.getDeletionState(actor);
    if (!state.pending) return { pending: false };
    return {
      pending: true,
      purgeDate: formatDay(state.purgeAfter),
      days: daysUntil(state.purgeAfter, this.clock()),
    };
  }

  async cancelDeletion(_accountId?: string): ReturnType<AccountRepository['cancelDeletion']> {
    const actor = await this.io.pendingDeletionActor();
    if (!actor) return { ok: false as const, reason: 'network' as const };
    try {
      await this.service.cancelDeletion(actor, await this.io.meta());
      return { ok: true as const };
    } catch {
      return { ok: false as const, reason: 'network' as const };
    }
  }
}
