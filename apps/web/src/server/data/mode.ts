import { realAuthEnabled } from '../auth/mode';

type Env = Record<string, string | undefined>;

/**
 * Real viewer data (catalog, profiles, My List, progress, account) or the fixtures from lane E.
 * Production is always real and ignores VIEWER_FIXTURES. Elsewhere VIEWER_FIXTURES=on keeps the fixtures for UI
 * work and for tests. Real data needs real auth, because fixture accounts have no database rows.
 */
export function realDataEnabled(env: Env = process.env): boolean {
  if (env.NODE_ENV === 'production') return true;
  if (env.VIEWER_FIXTURES === 'on') return false;
  return realAuthEnabled(env);
}
