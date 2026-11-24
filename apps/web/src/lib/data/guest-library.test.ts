import { describe, expect, it, vi } from 'vitest';
import { guestContext } from './types';
import type { LibraryRepository, ViewerContext } from './types';
import { forGuests } from './guest-library';

const account = {
  guest: undefined,
  profileId: 'p1',
  accountId: 'a1',
  audience: 'adult',
} as unknown as ViewerContext;

function inner() {
  return {
    myListIds: vi.fn(async () => ['video:a']),
    continueWatching: vi.fn(async () => []),
    addToList: vi.fn(async () => undefined),
  } as unknown as LibraryRepository;
}

describe('forGuests', () => {
  it('sends an account to the real library untouched', async () => {
    const real = inner();
    const lib = forGuests(real);
    expect(await lib.myListIds(account)).toEqual(['video:a']);
    await lib.addToList(account, 'video:a');
    expect(real.addToList).toHaveBeenCalledWith(account, 'video:a');
  });

  it('answers a guest without touching the real library and refuses writes', async () => {
    const real = inner();
    const lib = forGuests(real);
    const guest = guestContext('adult');
    expect(await lib.myListIds(guest)).toEqual([]);
    expect(await lib.continueWatching(guest)).toEqual([]);
    await expect(lib.addToList(guest, 'video:a')).rejects.toThrow();
    expect(real.myListIds).not.toHaveBeenCalled();
    expect(real.addToList).not.toHaveBeenCalled();
  });
});
