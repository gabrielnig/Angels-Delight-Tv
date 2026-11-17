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

type Service = Pick<StaffService, 'getOverview' | 'changePassword' | 'deleteAccount'>;
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
  buildExport(accountId: string, account: { email: string; memberSince: string }): Promise<unknown>;
  signExportToken(accountId: string): string;
}

export const EXPORT_FILE_NAME = 'angels-delight-data.json';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

  /** Exports are built on request and are not stored, so there is never an earlier export to show. */
  async exportState(_accountId?: string): Promise<ExportState> {
    return this.viewer ? { status: 'none' } : this.fallback.exportState();
  }

  /**
   * Builds the file now to size it, and hands back a ten minute link that rebuilds it. A queued job with an
   * email link (M02-S05) waits for the worker, see docs/lanes/K1-viewer-integration.md.
   */
  async requestExport(accountId: string): Promise<ExportState> {
    if (!this.viewer) return this.fallback.requestExport();
    const actor = await this.actor(accountId);
    const info = await this.service.getOverview(actor);
    const file = await this.viewer.buildExport(accountId, {
      email: info.email,
      memberSince: info.memberSince.toISOString(),
    });
    const bytes = Buffer.byteLength(JSON.stringify(file, null, 2));
    return {
      status: 'ready',
      requestedAt: 'just now',
      fileName: EXPORT_FILE_NAME,
      sizeLabel: bytes < 1024 ? `${bytes} bytes` : `${(bytes / 1024).toFixed(1)} KB`,
      expiresLabel: 'in 10 minutes',
      downloadHref: `/api/account/export?token=${this.viewer.signExportToken(accountId)}`,
    };
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
      displayName: displayNameFrom(info.email),
      email: info.email,
      verified: info.emailVerified,
      memberSince: `${since.getUTCDate()} ${MONTHS[since.getUTCMonth()]} ${since.getUTCFullYear()}`,
      ...stats,
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
