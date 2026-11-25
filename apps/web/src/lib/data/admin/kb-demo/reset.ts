import { resetHelpProgressFixture } from '../help-progress';
import { adminDataMode } from '../mode';
import { resetInviteCodeFixture } from '../invite-codes';
import { resetNoticeFixture } from '../notices';
import { getStore, resetStore, seedStore, type AdminStore } from '../store';
import { applyDemo } from './apply';
import { DEMO_DATASET, DEMO_NOW_ISO } from './dataset';

type Env = Record<string, string | undefined>;

/**
 * The demo reset only exists on a development fixture build started with KB_DEMO=on (plan section 11.1). Production,
 * real data and a plain dev server never expose it.
 */
export function kbDemoAllowed(env: Env = process.env): boolean {
  if (env.NODE_ENV === 'production') return false;
  if (env.KB_DEMO !== 'on') return false;
  try {
    return adminDataMode(env) === 'fixture';
  } catch {
    return false;
  }
}

/** State other fixture services keep on `globalThis`. Dropping it makes the next call build it fresh. */
const HELD_STATE = ['ad.admin.fixture.markers', 'ad.admin.fixture.auth', 'ad.theme.runtime', 'ad.kb.money'];

/** Puts the in memory admin store back to the demo dataset at the pinned clock. Returns the clock it used. */
export function resetDemoStore(): { now: number; store: AdminStore } {
  const now = Date.parse(DEMO_NOW_ISO);
  const holder = globalThis as unknown as Record<symbol, unknown>;
  for (const key of HELD_STATE) delete holder[Symbol.for(key)];
  resetNoticeFixture();
  resetHelpProgressFixture();
  resetInviteCodeFixture();
  const store = resetStore(applyDemo(seedStore(now), DEMO_DATASET, now));
  return { now, store: store ?? getStore() };
}
