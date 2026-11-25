import type { Database } from '@ad/db';
import { readSetting } from '@ad/theme/settings';

/** The hero clip length for the clip job: site setting `home.hero_clip_seconds` in milliseconds, 20 seconds when unset or invalid. */
export const heroClipMsReader = (db: Pick<Database, 'select'>) => async (): Promise<number> =>
  (await readSetting(db, 'home.hero_clip_seconds')) * 1000;
