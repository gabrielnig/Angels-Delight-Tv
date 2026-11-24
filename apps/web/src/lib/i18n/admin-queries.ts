import 'server-only';
import type { Actor } from '@ad/shared';
import { BASELINES, EN_NG, type CatalogShape, type LocaleCode } from '@ad/shared/messages';
import { themeRuntime } from '../data/admin/theme-runtime';
import { buildLanguageRows, buildWorkspaceRows } from './admin-data';
import { i18nRuntime } from './runtime';

const english = EN_NG as unknown as CatalogShape;
const TRANSLATABLE = ['yo', 'ig', 'ha', 'pcm'] as const;

export async function languageOverview(actor: Actor) {
  const [rt, theme] = await Promise.all([i18nRuntime(), themeRuntime()]);
  const store = rt.storeFor(actor);
  const rowsByLocale = Object.fromEntries(
    await Promise.all(TRANSLATABLE.map(async (l) => [l, await store.list(l)] as const)),
  );
  return buildLanguageRows({
    english,
    enabled: await theme.settings.get('content.ui_languages'),
    min: await theme.settings.get('i18n.publish_min_percent'),
    rowsByLocale,
    baselines: BASELINES,
  });
}

export async function workspaceData(actor: Actor, locale: Exclude<LocaleCode, 'en'>) {
  const rt = await i18nRuntime();
  return buildWorkspaceRows({
    locale,
    english,
    baseline: BASELINES[locale],
    rows: await rt.storeFor(actor).list(locale),
  });
}

/** Keys viewers hit in English, most hit first, for the Viewer hits tab. */
export async function missingReport(actor: Actor, locale: string) {
  const rt = await i18nRuntime();
  const rows = await rt.missing(actor).list(locale);
  return rows.map((r) => ({ key: r.key, hits: r.hits, lastSeen: r.lastSeen.toISOString().slice(0, 10) }));
}
