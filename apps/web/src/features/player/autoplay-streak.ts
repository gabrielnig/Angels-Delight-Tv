/** Autoplays in a row with no input, kept for the browser session so it survives the page change (L4-08). */
export const STREAK_KEY = 'ad:autoplay-streak';

interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createAutoplayStreak(store: Store | null): {
  get(): number;
  set(value: number): void;
} {
  let memory = 0;
  return {
    get() {
      try {
        const raw = store?.getItem(STREAK_KEY);
        if (raw === null || raw === undefined) return memory;
        const n = Number(raw);
        return Number.isInteger(n) && n >= 0 ? n : 0;
      } catch {
        return memory;
      }
    },
    set(value) {
      memory = value;
      try {
        store?.setItem(STREAK_KEY, String(value));
      } catch {
        // Blocked storage: the count lives in memory for this page only.
      }
    },
  };
}
