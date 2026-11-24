import { describe, expect, it } from 'vitest';
import {
  GUEST_PROGRESS_CAP,
  GUEST_PROGRESS_KEY,
  clearGuestProgress,
  createGuestProgressSink,
  firstUnfinished,
  listGuestProgress,
  readGuestProgress,
  removeGuestProgress,
  writeGuestProgress,
  type GuestStore,
} from './progress-store';

function memory(
  initial: Record<string, string> = {},
): GuestStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
}
const id = (n: number) => `0192f0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

describe('guest progress store (M40-S04)', () => {
  it('uses one versioned key', () => {
    expect(GUEST_PROGRESS_KEY).toBe('ad:guest:progress:v1');
    expect(GUEST_PROGRESS_CAP).toBe(100);
  });

  it('writes and reads a place with seconds, duration, finished and the write time', () => {
    const store = memory();
    expect(writeGuestProgress(store, id(1), { p: 134, d: 600, f: false }, 1000)).toEqual({
      ok: true,
    });
    expect(readGuestProgress(store, id(1))).toEqual({ p: 134, d: 600, f: false, t: 1000 });
    expect(JSON.parse(store.data[GUEST_PROGRESS_KEY]!)).toMatchObject({ v: 1 });
    expect(Object.keys(store.data)).toEqual([GUEST_PROGRESS_KEY]);
  });

  it('returns null for an unknown video', () => {
    expect(readGuestProgress(memory(), id(9))).toBeNull();
  });

  it('keeps only the newest write for one video', () => {
    const store = memory();
    writeGuestProgress(store, id(1), { p: 10, d: 100, f: false }, 1);
    writeGuestProgress(store, id(1), { p: 50, d: 100, f: false }, 2);
    expect(readGuestProgress(store, id(1))?.p).toBe(50);
    expect(listGuestProgress(store)).toHaveLength(1);
  });

  it('drops the least recently written entry when the cap of 100 is passed', () => {
    const store = memory();
    for (let i = 0; i < 100; i++)
      writeGuestProgress(store, id(i), { p: 10, d: 100, f: false }, 1000 + i);
    // Touch the oldest so the second oldest becomes the one to go.
    writeGuestProgress(store, id(0), { p: 20, d: 100, f: false }, 5000);
    writeGuestProgress(store, id(500), { p: 10, d: 100, f: false }, 6000);
    expect(listGuestProgress(store, { limit: 1000 })).toHaveLength(100);
    expect(readGuestProgress(store, id(1))).toBeNull();
    expect(readGuestProgress(store, id(0))).not.toBeNull();
    expect(readGuestProgress(store, id(500))).not.toBeNull();
  });

  it('lists newest first with a limit and the video id on each entry', () => {
    const store = memory();
    writeGuestProgress(store, id(1), { p: 10, d: 100, f: false }, 1);
    writeGuestProgress(store, id(2), { p: 10, d: 100, f: true }, 3);
    writeGuestProgress(store, id(3), { p: 10, d: 100, f: false }, 2);
    expect(listGuestProgress(store).map((e) => e.videoId)).toEqual([id(2), id(3), id(1)]);
    expect(listGuestProgress(store, { limit: 2 })).toHaveLength(2);
  });

  it('removes one entry and clears all', () => {
    const store = memory();
    writeGuestProgress(store, id(1), { p: 10, d: 100, f: false }, 1);
    writeGuestProgress(store, id(2), { p: 10, d: 100, f: false }, 2);
    removeGuestProgress(store, id(1));
    expect(readGuestProgress(store, id(1))).toBeNull();
    clearGuestProgress(store);
    expect(store.data[GUEST_PROGRESS_KEY]).toBeUndefined();
  });

  it.each([
    ['not json', '{oops'],
    ['wrong version', JSON.stringify({ v: 2, items: {} })],
    ['wrong shape', JSON.stringify({ v: 1, items: [] })],
    ['array', '[]'],
    ['null', 'null'],
  ])('treats a corrupt value (%s) as empty and the next write repairs it', (_n, value) => {
    const store = memory({ [GUEST_PROGRESS_KEY]: value });
    expect(listGuestProgress(store)).toEqual([]);
    expect(readGuestProgress(store, id(1))).toBeNull();
    expect(writeGuestProgress(store, id(1), { p: 5, d: 50, f: false }, 9)).toEqual({ ok: true });
    expect(readGuestProgress(store, id(1))?.p).toBe(5);
  });

  it('drops entries with bad numbers instead of failing', () => {
    const store = memory({
      [GUEST_PROGRESS_KEY]: JSON.stringify({
        v: 1,
        items: {
          [id(1)]: { p: -5, d: 100, f: false, t: 1 },
          [id(2)]: { p: 'x', d: 100, f: false, t: 1 },
          [id(3)]: { p: 10, d: 100, f: false, t: 1 },
          'not-a-uuid': { p: 10, d: 100, f: false, t: 1 },
        },
      }),
    });
    expect(listGuestProgress(store).map((e) => e.videoId)).toEqual([id(3)]);
  });

  it('reports a blocked or full store without throwing', () => {
    const throwing: GuestStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(writeGuestProgress(throwing, id(1), { p: 1, d: 10, f: false }, 1)).toEqual({
      ok: false,
    });
    expect(readGuestProgress(throwing, id(1))).toBeNull();
    expect(listGuestProgress(throwing)).toEqual([]);
    expect(() => removeGuestProgress(throwing, id(1))).not.toThrow();
    expect(() => clearGuestProgress(throwing)).not.toThrow();
  });

  it('handles a null store (no localStorage)', () => {
    expect(writeGuestProgress(null, id(1), { p: 1, d: 10, f: false }, 1)).toEqual({ ok: false });
    expect(readGuestProgress(null, id(1))).toBeNull();
    expect(listGuestProgress(null)).toEqual([]);
  });

  describe('sink', () => {
    it('saves a player update as seconds, duration and finished, and flags an unsaved place once', async () => {
      const store = memory();
      let flagged = 0;
      const sink = createGuestProgressSink(store, {
        now: () => 42,
        onUnavailable: () => flagged++,
      });
      await sink.save({
        videoId: id(1),
        profileId: 'x',
        positionSeconds: 12.7,
        durationSeconds: 300,
        ended: false,
      });
      expect(readGuestProgress(store, id(1))).toEqual({ p: 12, d: 300, f: false, t: 42 });

      const blocked = createGuestProgressSink(null, { onUnavailable: () => flagged++ });
      const update = {
        videoId: id(1),
        profileId: 'x',
        positionSeconds: 1,
        durationSeconds: 10,
        ended: false,
      };
      await blocked.save(update);
      await blocked.save(update);
      expect(flagged).toBe(1);
    });

    it('keeps a finished flag sticky only for that write and never throws', async () => {
      const sink = createGuestProgressSink(memory());
      await expect(
        sink.save({
          videoId: id(1),
          profileId: 'x',
          positionSeconds: 100,
          durationSeconds: 100,
          ended: true,
        }),
      ).resolves.toBeUndefined();
    });
  });
});

describe('firstUnfinished (M08-S13 AC4)', () => {
  const items = [{ id: id(1) }, { id: id(2) }, { id: id(3) }];

  it('returns the first item this device has not finished', () => {
    const store = memory();
    writeGuestProgress(store, id(1), { p: 99, d: 100, f: true }, 1);
    writeGuestProgress(store, id(2), { p: 10, d: 100, f: false }, 2);
    expect(firstUnfinished(store, items)?.id).toBe(id(2));
  });

  it('returns the first item when nothing is stored or storage is blocked', () => {
    expect(firstUnfinished(memory(), items)?.id).toBe(id(1));
    expect(firstUnfinished(null, items)?.id).toBe(id(1));
  });

  it('returns null when every item is finished', () => {
    const store = memory();
    items.forEach((i, n) => writeGuestProgress(store, i.id, { p: 9, d: 10, f: true }, n));
    expect(firstUnfinished(store, items)).toBeNull();
  });
});
