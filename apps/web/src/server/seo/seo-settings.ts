import 'server-only';
import { defaultSettings } from '@ad/theme/settings';
import { themeRuntime } from '../../lib/data/admin/theme-runtime';
import { resolveSeoSettings, type SeoSettings } from '../../lib/site/seo-settings';

/** Never throws: a failed read serves the defaults, so a settings outage cannot take a page down. */
export async function getSeoSettings(): Promise<SeoSettings> {
  try {
    const rt = await themeRuntime();
    return resolveSeoSettings(await rt.settings.getAll());
  } catch {
    return resolveSeoSettings(defaultSettings());
  }
}
