import { describe, expect, it, vi } from 'vitest';
import { GUEST_PROGRESS_KEY, listGuestProgress, writeGuestProgress } from './progress-store';
import { buildImportItems, runImport } from './import';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe('buildImportItems', () => {
  it('turns device entries into milliseconds for the server', () => {
    const store = memory();
    writeGuestProgress(store, A, { p: 134, d: 600, f: false }, 5000);
    writeGuestProgress(store, B, { p: 590, d: 600, f: true }, 6000);
    expect(buildImportItems(store)).toEqual([
      { videoId: B, positionMs: 590_000, finished: true, updatedAt: 6000 },
      { videoId: A, positionMs: 134_000, finished: false, updatedAt: 5000 },
    ]);
  });

  it('is empty with nothing saved or no storage', () => {
    expect(buildImportItems(memory())).toEqual([]);
    expect(buildImportItems(null)).toEqual([]);
  });
});

describe('runImport', () => {
  it('posts to the import route, then clears the device history it moved', async () => {
    const store = memory();
    writeGuestProgress(store, A, { p: 134, d: 600, f: false });
    const post = vi.fn(async () => ({ ok: true, imported: 1, skipped: 0 }));
    const result = await runImport({ store, profileId: 'p1', post });
    expect(post).toHaveBeenCalledWith({
      profileId: 'p1',
      items: [expect.objectContaining({ videoId: A, positionMs: 134_000 })],
    });
    expect(result).toEqual({ ok: true, imported: 1 });
    expect(store.data.has(GUEST_PROGRESS_KEY)).toBe(false);
  });

  it('keeps the device history when the server refuses, so nothing is lost', async () => {
    const store = memory();
    writeGuestProgress(store, A, { p: 134, d: 600, f: false });
    const result = await runImport({ store, profileId: 'p1', post: async () => ({ ok: false }) });
    expect(result).toEqual({ ok: false });
    expect(listGuestProgress(store)).toHaveLength(1);
  });

  it('keeps it when the request throws', async () => {
    const store = memory();
    writeGuestProgress(store, A, { p: 134, d: 600, f: false });
    const result = await runImport({
      store,
      profileId: 'p1',
      post: async () => {
        throw new TypeError('offline');
      },
    });
    expect(result).toEqual({ ok: false });
    expect(listGuestProgress(store)).toHaveLength(1);
  });

  it('does not call the server when there is nothing to move', async () => {
    const post = vi.fn();
    expect(await runImport({ store: memory(), profileId: 'p1', post })).toEqual({
      ok: true,
      imported: 0,
    });
    expect(post).not.toHaveBeenCalled();
  });
});
