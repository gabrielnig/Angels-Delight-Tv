/** Throwaway credentials for the local video end to end run. They only exist in the e2e database. */
export const ACCOUNTS = {
  admin: { email: 'admin@e2e.test', password: 'lantern-river-mango-42' },
  viewer: { email: 'viewer@e2e.test', password: 'copper-valley-sunrise-77' },
} as const;
