import { settings, type Database } from '@ad/db';
import { eq } from 'drizzle-orm';
import { SETTING_DEFS, type SettingKey, type SettingValue } from './settings-registry';

export interface ReadSettingOptions {
  /** Called when a stored value no longer passes its schema, so the fallback is visible in logs. */
  onInvalid?: (key: SettingKey) => void;
}

/**
 * Reads one setting straight from the table for background jobs, without the web cache. A missing row or a
 * stored value that fails validation gives the compiled default (M29-S02 error case).
 */
export async function readSetting<K extends SettingKey>(
  db: Pick<Database, 'select'>,
  key: K,
  options: ReadSettingOptions = {},
): Promise<SettingValue<K>> {
  const def = SETTING_DEFS[key];
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  if (!row) return def.default as SettingValue<K>;
  const parsed = def.schema.safeParse(row.value);
  if (parsed.success) return parsed.data as SettingValue<K>;
  options.onInvalid?.(key);
  return def.default as SettingValue<K>;
}
