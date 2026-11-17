import type { AccountOverview, AccountRepository, DeviceSession, ExportState, PlaybackSettings } from '../types';

const DEFAULTS: PlaybackSettings = {
  autoplayNext: true,
  dataSaver: false,
  quality: 'auto',
  speed: 1,
  captionsDefault: true,
  captionSize: 'medium',
};

const globalStore = globalThis as unknown as {
  __adFixtureAccount?: { playback: Map<string, PlaybackSettings>; devices: DeviceSession[]; exportState: ExportState };
};

const state = (globalStore.__adFixtureAccount ??= {
  playback: new Map(),
  devices: [
    { id: 'dev-1', label: 'Chrome on Android', place: 'Lagos, Nigeria', lastActive: 'Active now', current: true },
    { id: 'dev-2', label: 'Safari on iPhone', place: 'Ibadan, Nigeria', lastActive: '2 days ago', current: false },
    { id: 'dev-3', label: 'Edge on Windows', place: 'Abuja, Nigeria', lastActive: 'Yesterday', current: false },
  ],
  exportState: { status: 'none' },
});

export class FixtureAccount implements AccountRepository {
  async overview(): Promise<AccountOverview> {
    return {
      displayName: 'Adaeze Okafor',
      email: 'adaeze.okafor@example.com',
      verified: true,
      memberSince: '3 Mar 2026',
      watchedThisMonth: 14,
      minutesLearning: 220,
      myListCount: 5,
      devices: state.devices.length,
    };
  }

  async playback(profileId: string) {
    return state.playback.get(profileId) ?? { ...DEFAULTS };
  }

  async savePlayback(profileId: string, patch: Partial<PlaybackSettings>) {
    const next = { ...(state.playback.get(profileId) ?? DEFAULTS), ...patch };
    state.playback.set(profileId, next);
    return next;
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
    if (input.current === 'wrong-password') return { ok: false as const, reason: 'wrong_current' as const };
    if (input.next.length < 10) return { ok: false as const, reason: 'weak' as const };
    const signedOut = state.devices.filter((d) => !d.current).length;
    state.devices = state.devices.filter((d) => d.current);
    return { ok: true as const, signedOutDevices: signedOut };
  }

  async exportState() {
    return { ...state.exportState };
  }

  async requestExport() {
    state.exportState = { status: 'pending', requestedAt: 'today at 9:14 am' };
    return { ...state.exportState };
  }

  async deleteAccount(_accountId: string, input: { password: string; confirm: string }) {
    if (input.confirm !== 'DELETE') return { ok: false as const, reason: 'confirm' as const };
    if (input.password === 'wrong-password') return { ok: false as const, reason: 'wrong_password' as const };
    return { ok: true as const, days: 14 };
  }
}

export function resetFixtureAccount() {
  state.playback.clear();
  state.exportState = { status: 'none' };
}
