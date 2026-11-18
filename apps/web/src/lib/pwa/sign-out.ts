/**
 * Sign out that works offline (M01-S10 AC3). Local state is cleared at once. When the server cannot be reached
 * the revocation is queued in a flag and completed the next time the app is online.
 */
export const PENDING_SIGN_OUT_KEY = 'ad.pendingsignout.v1';

/** Key prefixes that hold one person's data. Device level settings (install prompt, theme) stay. */
const PRIVATE_PREFIXES = [
  'ad.pickercache',
  'ad.writequeue',
  'ad.progress.',
  'ad.datasaver.p',
  'ad-recent-searches',
];

export interface KeyStore {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function clearPrivateClientState(store: KeyStore): void {
  const doomed: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key && PRIVATE_PREFIXES.some((prefix) => key.startsWith(prefix))) doomed.push(key);
  }
  for (const key of doomed) store.removeItem(key);
}

export function hasPendingSignOut(store: Pick<KeyStore, 'getItem'>): boolean {
  return store.getItem(PENDING_SIGN_OUT_KEY) !== null;
}

export async function requestSignOut(deps: {
  store: KeyStore;
  online: () => boolean;
  signOut: () => Promise<void>;
  clearCaches: () => boolean;
}): Promise<'done' | 'queued'> {
  clearPrivateClientState(deps.store);
  deps.clearCaches();
  if (deps.online()) {
    try {
      await deps.signOut();
      return 'done';
    } catch {
      // Fall through: the network dropped between the check and the call.
    }
  }
  try {
    deps.store.setItem(PENDING_SIGN_OUT_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the cleared state is still gone, the server session ends by expiry.
  }
  return 'queued';
}

/** Returns true when a queued revocation was completed. */
export async function completePendingSignOut(deps: {
  store: KeyStore;
  online: () => boolean;
  signOut: () => Promise<void>;
}): Promise<boolean> {
  if (!hasPendingSignOut(deps.store) || !deps.online()) return false;
  try {
    await deps.signOut();
  } catch {
    return false;
  }
  deps.store.removeItem(PENDING_SIGN_OUT_KEY);
  return true;
}
