import type { LibraryRepository } from './types';

const needsAccount = () => Promise.reject(new Error('This needs an account'));

/**
 * The library for a visitor with no account (M40): My List and Continue Watching on the server do not exist for
 * guests. Reads are empty, writes are refused. The guest Continue learning row lives on the device
 * (`lib/guest/progress-store.ts`).
 */
export const guestLibrary: LibraryRepository = {
  myList: async () => ({ items: [], total: 0, nextCursor: null, hiddenCount: 0 }),
  myListIds: async () => [],
  addToList: needsAccount,
  removeFromList: needsAccount,
  continueWatching: async () => [],
  removeFromContinue: needsAccount,
  restoreContinue: needsAccount,
};

/** Routes a guest context to `guestLibrary` and every other context to the real library, so no guest call reaches the account tables. */
export function forGuests(inner: LibraryRepository): LibraryRepository {
  const pick = (ctx: { guest?: true }) => (ctx.guest ? guestLibrary : inner);
  return {
    myList: (ctx, cursor) => pick(ctx).myList(ctx, cursor),
    myListIds: (ctx) => pick(ctx).myListIds(ctx),
    addToList: (ctx, key) => pick(ctx).addToList(ctx, key),
    removeFromList: (ctx, key) => pick(ctx).removeFromList(ctx, key),
    continueWatching: (ctx) => pick(ctx).continueWatching(ctx),
    removeFromContinue: (ctx, id) => pick(ctx).removeFromContinue(ctx, id),
    restoreContinue: (ctx, id) => pick(ctx).restoreContinue(ctx, id),
  };
}
