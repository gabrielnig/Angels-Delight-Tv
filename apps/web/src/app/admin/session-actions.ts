'use server';

import { realSessionTimes } from '@/server/auth/admin';

/**
 * "Stay signed in": reading the session on the server restarts its idle timer, so this only reports how long
 * is left now. Null means the session already ended.
 */
export async function extendSessionAction(): Promise<{ remainingMs: number } | null> {
  const times = await realSessionTimes();
  if (!times) return null;
  return { remainingMs: Math.min(times.idleMs, times.absoluteMs) };
}
