import { assertAllowedOrigin } from './origin-guard';

/**
 * Puts the demo stack back to its seeded state and returns the pinned clock. Called before every episode so a flow
 * that saves something never changes what the next one shows. The origin guard runs first.
 */
export async function resetDemo(baseURL: string): Promise<{ now: number }> {
  assertAllowedOrigin(baseURL);
  const res = await fetch(new URL('/api/kb-demo/reset', baseURL), {
    method: 'POST',
    headers: { 'x-kb-demo': 'reset' },
  });
  if (!res.ok) {
    throw new Error(
      `Demo reset failed with ${res.status}. Start the web app with KB_DEMO=on and ADMIN_DATA=fixture (scripts/kb-stack.sh).`,
    );
  }
  return (await res.json()) as { now: number };
}
