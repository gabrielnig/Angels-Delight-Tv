import type {
  AccountOverview,
  AccountRepository,
  DeviceSession,
  ExportState,
  PlaybackSettings,
} from '../types';

const DEFAULTS: PlaybackSettings = {
  autoplayNext: true,
  autoplayPreviews: false,
  dataSaver: false,
  quality: 'auto',
  speed: 1,
  captionsDefault: true,
  captionSize: 'medium',
  captionBackground: 'dark',
  captionContrast: 'standard',
  captionLanguage: 'en',
};

const globalStore = globalThis as unknown as {
  __adFixtureAccount?: {
    playback: Map<string, PlaybackSettings>;
    devices: DeviceSession[];
    exportState: ExportState;
    deletionPending: boolean;
    migrated: Set<string>;
    name: string;
    email: string;
    pendingEmail: string | null;
  };
};

const state = (globalStore.__adFixtureAccount ??= {
  playback: new Map(),
  devices: [
    {
      id: 'dev-1',
      label: 'Chrome on Android',
      place: 'Lagos, Nigeria',
      lastActive: 'Active now',
      current: true,
    },
    {
      id: 'dev-2',
      label: 'Safari on iPhone',
      place: 'Ibadan, Nigeria',
      lastActive: '2 days ago',
      current: false,
    },
    {
      id: 'dev-3',
      label: 'Edge on Windows',
      place: 'Abuja, Nigeria',
      lastActive: 'Yesterday',
      current: false,
    },
  ],
  exportState: { status: 'none' },
  deletionPending: false,
  migrated: new Set<string>(),
  name: 'Adaeze Okafor',
  email: 'adaeze.okafor@example.com',
  pendingEmail: null,
});

/** The code the fixture accepts for an email change. Real data mails a random one. */
export const FIXTURE_EMAIL_CODE = '123456';

export class FixtureAccount implements AccountRepository {
  async overview(): Promise<AccountOverview> {
    return {
      displayName: state.name,
      email: state.email,
      verified: true,
      memberSince: '3 Mar 2026',
      watchedThisMonth: 14,
      minutesLearning: 220,
      myListCount: 5,
      devices: state.devices.length,
      passwordChanged: '12 Aug 2026',
    };
  }

  async updateName(_accountId: string, name: string) {
    const clean = name.replace(/\s+/g, ' ').trim();
    if (clean.length === 0 || clean.length > 80)
      return { ok: false as const, reason: 'invalid' as const };
    state.name = clean;
    return { ok: true as const, name: clean };
  }

  async requestEmailChange(_accountId: string, input: { newEmail: string; password: string }) {
    if (input.password === 'wrong-password')
      return { ok: false as const, reason: 'wrong_password' as const };
    const target = input.newEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target))
      return { ok: false as const, reason: 'invalid_email' as const };
    if (target === state.email) return { ok: false as const, reason: 'same_email' as const };
    state.pendingEmail = target;
    return { ok: true as const, pendingEmail: target };
  }

  async confirmEmailChange(_accountId: string, input: { code: string }) {
    if (!state.pendingEmail || input.code !== FIXTURE_EMAIL_CODE)
      return { ok: false as const, reason: 'invalid' as const };
    state.email = state.pendingEmail;
    state.pendingEmail = null;
    return { ok: true as const };
  }

  async playback(profileId: string) {
    return state.playback.get(profileId) ?? { ...DEFAULTS };
  }

  async savePlayback(profileId: string, patch: Partial<PlaybackSettings>) {
    const next = { ...(state.playback.get(profileId) ?? DEFAULTS), ...patch };
    state.playback.set(profileId, next);
    return next;
  }

  async migrateDevicePlayback(profileId: string, legacy: Record<string, unknown>) {
    if (state.migrated.has(profileId)) return state.playback.get(profileId) ?? DEFAULTS;
    state.migrated.add(profileId);
    const allowed = ['speed', 'captionsDefault', 'captionLanguage', 'dataSaver', 'autoplayNext'];
    const patch = Object.fromEntries(Object.entries(legacy).filter(([k]) => allowed.includes(k)));
    return this.savePlayback(profileId, patch as Partial<PlaybackSettings>);
  }

  async devices() {
    return [...state.devices];
  }

  async revokeDevice(_accountId: string, id: string) {
    state.devices = state.devices.filter((d) => d.id !== id || d.current);
  }

  async revokeOtherDevices() {
    const others = state.devices.filter((d) => !d.current).length;
    state.devices = state.devices.filter((d) => d.current);
    return others;
  }

  async changePassword(_accountId: string, input: { current: string; next: string }) {
    if (input.current === 'wrong-password')
      return { ok: false as const, reason: 'wrong_current' as const };
    if (input.next.length < 10) return { ok: false as const, reason: 'weak' as const };
    const signedOut = state.devices.filter((d) => !d.current).length;
    state.devices = state.devices.filter((d) => d.current);
    return { ok: true as const, signedOutDevices: signedOut };
  }

  async exportState() {
    return { ...state.exportState };
  }

  async requestExport(_accountId?: string, input?: { password: string }) {
    if (input?.password === 'wrong-password')
      return { ok: false as const, reason: 'wrong_password' as const };
    if (state.exportState.status === 'pending' || state.exportState.status === 'ready')
      return { ok: true as const, already: true, state: { ...state.exportState } };
    state.exportState = { status: 'pending', requestedAt: 'today at 9:14 am' };
    return { ok: true as const, already: false, state: { ...state.exportState } };
  }

  async deleteAccount(_accountId: string, input: { password: string; confirm: string }) {
    if (input.confirm !== 'DELETE') return { ok: false as const, reason: 'confirm' as const };
    if (input.password === 'wrong-password')
      return { ok: false as const, reason: 'wrong_password' as const };
    state.deletionPending = true;
    return { ok: true as const, days: 14 };
  }

  async deletionState(_accountId?: string) {
    return state.deletionPending
      ? { pending: true as const, purgeDate: '1 Dec 2026', days: 14 }
      : { pending: false as const };
  }

  async cancelDeletion(_accountId?: string) {
    state.deletionPending = false;
    state.migrated.clear();
    return { ok: true as const };
  }
}

export function resetFixtureAccount() {
  state.playback.clear();
  state.exportState = { status: 'none' };
  state.deletionPending = false;
  state.migrated.clear();
}
