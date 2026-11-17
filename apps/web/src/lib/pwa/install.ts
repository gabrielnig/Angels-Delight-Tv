const DAY = 86_400_000;
const HOUR = 3_600_000;
const MIN_GAP_DAYS = 3;
const DISMISS_DAYS = 30;
const MAX_DISMISSALS = 2;
const MAX_VISITS = 10;

export interface InstallState {
  visits: number[];
  dismissedUntil: number | null;
  dismissCount: number;
  installed: boolean;
}

export type InstallPlatform = 'chromium' | 'ios-safari' | 'ios-other' | 'standalone' | 'none';

export const INSTALL_STORAGE_KEY = 'ad.install.v1';

export function recordVisit(state: InstallState, now: number): InstallState {
  const last = state.visits.at(-1);
  if (last !== undefined && now - last < HOUR) return state;
  return { ...state, visits: [...state.visits, now].slice(-MAX_VISITS) };
}

export function dismissInstall(state: InstallState, now: number): InstallState {
  return {
    ...state,
    dismissCount: state.dismissCount + 1,
    dismissedUntil: now + DISMISS_DAYS * DAY,
  };
}

/** Visited at least twice and 3 days apart, not dismissed for 30 days, never after two dismissals or an install. */
export function shouldShowInstall(
  state: InstallState,
  now: number,
  platform: InstallPlatform,
): boolean {
  if (platform === 'none' || platform === 'standalone' || state.installed) return false;
  if (state.dismissCount >= MAX_DISMISSALS) return false;
  if (state.dismissedUntil !== null && now < state.dismissedUntil) return false;
  const first = state.visits[0];
  const last = state.visits.at(-1);
  if (first === undefined || last === undefined || state.visits.length < 2) return false;
  return last - first >= MIN_GAP_DAYS * DAY;
}

export function detectPlatform(input: {
  userAgent: string;
  standalone: boolean;
  /** True once the browser fired `beforeinstallprompt`. */
  canPrompt: boolean;
}): InstallPlatform {
  if (input.standalone) return 'standalone';
  if (/iPhone|iPad|iPod/i.test(input.userAgent)) {
    const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\/|GSA\/|Twitter/i.test(
      input.userAgent,
    );
    return otherBrowser || !/Safari/i.test(input.userAgent) ? 'ios-other' : 'ios-safari';
  }
  return input.canPrompt ? 'chromium' : 'none';
}

export const EMPTY_INSTALL_STATE: InstallState = {
  visits: [],
  dismissedUntil: null,
  dismissCount: 0,
  installed: false,
};

export function parseInstallState(raw: string | null): InstallState {
  if (!raw) return EMPTY_INSTALL_STATE;
  try {
    const value = JSON.parse(raw) as Partial<InstallState>;
    return {
      visits: Array.isArray(value.visits)
        ? value.visits.filter((n) => Number.isFinite(n)).slice(-MAX_VISITS)
        : [],
      dismissedUntil: typeof value.dismissedUntil === 'number' ? value.dismissedUntil : null,
      dismissCount: typeof value.dismissCount === 'number' ? value.dismissCount : 0,
      installed: value.installed === true,
    };
  } catch {
    return EMPTY_INSTALL_STATE;
  }
}
