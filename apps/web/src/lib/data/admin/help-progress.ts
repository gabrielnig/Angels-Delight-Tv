import { ARTICLE_ID } from '@ad/help';
import { delegating } from './mode';
import type { AdminActor } from './types';

/** A video counts as watched at this share of its length (D-377). */
export const WATCHED_AT = 0.9;

export interface GuideProgress {
  done: boolean;
  watched: boolean;
  helpful: boolean | null;
}
export type ProgressRows = Record<string, GuideProgress>;

/** Per account help centre progress (M50-S25, S26). Nothing else is stored with it. */
export interface HelpProgressService {
  read(actor: AdminActor): Promise<ProgressRows>;
  setGuideDone(actor: AdminActor, guide: string, done: boolean): Promise<void>;
  markVideoWatched(actor: AdminActor, guide: string): Promise<void>;
  setHelpful(actor: AdminActor, guide: string, helpful: boolean): Promise<void>;
}

export function assertGuide(id: string): void {
  if (!ARTICLE_ID.test(id)) throw new Error(`"${id}" is not a guide id.`);
}

export function summarizeProgress(
  rows: ProgressRows,
  visible: { guides: string[]; videos: string[] },
) {
  return {
    guidesDone: visible.guides.filter((id) => rows[id]?.done).length,
    guidesTotal: visible.guides.length,
    videosWatched: visible.videos.filter((id) => rows[id]?.watched).length,
    videosTotal: visible.videos.length,
  };
}

export function createFixtureHelpProgress(): HelpProgressService & { clear(): void } {
  const store = new Map<string, ProgressRows>();
  const row = (actor: AdminActor, guide: string): GuideProgress => {
    assertGuide(guide);
    const rows = store.get(actor.accountId) ?? {};
    store.set(actor.accountId, rows);
    return (rows[guide] ??= { done: false, watched: false, helpful: null });
  };
  return {
    clear() {
      store.clear();
    },
    async read(actor) {
      return structuredClone(store.get(actor.accountId) ?? {});
    },
    async setGuideDone(actor, guide, done) {
      row(actor, guide).done = done;
    },
    async markVideoWatched(actor, guide) {
      row(actor, guide).watched = true;
    },
    async setHelpful(actor, guide, helpful) {
      row(actor, guide).helpful = helpful;
    },
  };
}

const KEY = Symbol.for('ad.help.progress.fixture');
const holder = globalThis as unknown as Record<
  symbol,
  (HelpProgressService & { clear(): void }) | undefined
>;

export const helpProgress: HelpProgressService = delegating(
  (holder[KEY] ??= createFixtureHelpProgress()),
  async () => (await import('./real/help-progress')).realHelpProgress,
);

/** Forgets every account's progress on the fixture build. Only the KB demo reset calls it. */
export function resetHelpProgressFixture(): void {
  holder[KEY]?.clear();
}
