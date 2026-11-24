import { describe, expect, it } from 'vitest';
import { guestLibrary } from './guest-library';
import { guestContext } from './types';

const ctx = guestContext('adult');

describe('guest library (M40)', () => {
  it('answers every read with nothing', async () => {
    expect(await guestLibrary.myList(ctx)).toEqual({
      items: [],
      total: 0,
      nextCursor: null,
      hiddenCount: 0,
    });
    expect(await guestLibrary.myListIds(ctx)).toEqual([]);
    expect(await guestLibrary.continueWatching(ctx)).toEqual([]);
  });

  it('refuses every write, so a guest can never store anything on the server', async () => {
    await expect(guestLibrary.addToList(ctx, 'video:1')).rejects.toThrow(/account/i);
    await expect(guestLibrary.removeFromList(ctx, 'video:1')).rejects.toThrow(/account/i);
    await expect(guestLibrary.removeFromContinue(ctx, 'v')).rejects.toThrow(/account/i);
    await expect(guestLibrary.restoreContinue(ctx, 'v')).rejects.toThrow(/account/i);
  });
});
