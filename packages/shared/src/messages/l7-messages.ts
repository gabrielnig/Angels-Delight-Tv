/**
 * Copy for lane L7 (module M46): strings moved out of components by the extraction waves. Kept in its own file and
 * spread into `EN_NG`. Keys follow `area.kind.name`.
 */
export const L7_MESSAGES = {
  // Offline page (M25-S04, M46-S18)
  'offline.banner': 'You are offline. Check your data or Wi-Fi.',
  'offline.title': 'You are offline',
  'offline.body':
    'Pages you opened before may still work. Nothing has been lost. Videos need a connection to play on {name}.',
  'offline.retry': 'Try again',
} as const;
