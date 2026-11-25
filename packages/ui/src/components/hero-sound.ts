'use client';

import { useSyncExternalStore } from 'react';

/**
 * The viewer's sound choice for the Home hero clip (M41-S22, D-367). In memory only: it lasts until the page is
 * reloaded and survives moving between pages in the app, so the next clip follows it. Nothing is written to
 * sessionStorage or localStorage, so there is no storage inventory row. A clip always starts muted on a new visit.
 */
let on = false;
const listeners = new Set<() => void>();

export const heroSound = {
  get: () => on,
  set(value: boolean) {
    if (on === value) return;
    on = value;
    for (const listener of [...listeners]) listener();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};

/** Test helper: back to the muted start of a new visit. */
export function resetHeroSound() {
  on = false;
  listeners.clear();
}

export function useHeroSound(): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(heroSound.subscribe, heroSound.get, () => false);
  return [value, heroSound.set];
}
