import { describe, expect, it, vi } from 'vitest';
import {
  PENDING_SIGN_OUT_KEY,
  clearPrivateClientState,
  completePendingSignOut,
  hasPendingSignOut,
  requestSignOut,
} from './sign-out';

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    keys: () => Array.from(data.keys()),
  };
}

const privateState = {
  'ad.writequeue.v1': '[]',
  'ad.progress.p1': '{}',
  'ad.datasaver.p1': 'on',
  'ad-recent-searches': '["x"]',
  'ad.install.v1': '{}',
};

describe('sign out while offline (M01-S10 AC3)', () => {
  it('clears private client state and keeps device level settings', () => {
    const store = memoryStore(privateState);
    clearPrivateClientState(store);
    expect(store.keys()).toEqual(['ad.install.v1']);
  });

  it('online: revokes at once, clears state and leaves nothing queued', async () => {
    const store = memoryStore(privateState);
    const signOut = vi.fn().mockResolvedValue(undefined);
    const clearCaches = vi.fn().mockReturnValue(true);
    const result = await requestSignOut({ store, online: () => true, signOut, clearCaches });
    expect(result).toBe('done');
    expect(signOut).toHaveBeenCalledOnce();
    expect(clearCaches).toHaveBeenCalledOnce();
    expect(hasPendingSignOut(store)).toBe(false);
    expect(store.keys()).toEqual(['ad.install.v1']);
  });

  it('offline: clears locally at once and queues the revocation', async () => {
    const store = memoryStore(privateState);
    const signOut = vi.fn();
    const result = await requestSignOut({
      store,
      online: () => false,
      signOut,
      clearCaches: () => true,
    });
    expect(result).toBe('queued');
    expect(signOut).not.toHaveBeenCalled();
    expect(hasPendingSignOut(store)).toBe(true);
    expect(store.getItem('ad.progress.p1')).toBeNull();
  });

  it('a network failure while online also queues it', async () => {
    const store = memoryStore();
    const result = await requestSignOut({
      store,
      online: () => true,
      signOut: () => Promise.reject(new Error('network')),
      clearCaches: () => false,
    });
    expect(result).toBe('queued');
    expect(store.getItem(PENDING_SIGN_OUT_KEY)).not.toBeNull();
  });

  it('completes the queued revocation once online and clears the flag', async () => {
    const store = memoryStore({ [PENDING_SIGN_OUT_KEY]: '1' });
    const signOut = vi.fn().mockResolvedValue(undefined);
    expect(await completePendingSignOut({ store, online: () => false, signOut })).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
    expect(await completePendingSignOut({ store, online: () => true, signOut })).toBe(true);
    expect(signOut).toHaveBeenCalledOnce();
    expect(hasPendingSignOut(store)).toBe(false);
  });

  it('keeps the flag when the retry fails', async () => {
    const store = memoryStore({ [PENDING_SIGN_OUT_KEY]: '1' });
    const signOut = vi.fn().mockRejectedValue(new Error('network'));
    expect(await completePendingSignOut({ store, online: () => true, signOut })).toBe(false);
    expect(hasPendingSignOut(store)).toBe(true);
  });

  it('does nothing when no sign out is queued', async () => {
    const signOut = vi.fn();
    expect(
      await completePendingSignOut({ store: memoryStore(), online: () => true, signOut }),
    ).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
  });
});
