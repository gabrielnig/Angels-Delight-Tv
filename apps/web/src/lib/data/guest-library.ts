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
