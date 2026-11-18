import type { PlaybackSettings } from './data';

/** Autoplay next and Data saver belong to the parent account on a Kids profile (S29 state 3). */
export const KIDS_LOCKED: (keyof PlaybackSettings)[] = ['autoplayNext', 'dataSaver'];

export function withoutKidsLocked(
  patch: Partial<PlaybackSettings>,
  kids: boolean,
): Partial<PlaybackSettings> {
  if (!kids) return patch;
  return Object.fromEntries(
    Object.entries(patch).filter(([key]) => !KIDS_LOCKED.includes(key as keyof PlaybackSettings)),
  ) as Partial<PlaybackSettings>;
}
