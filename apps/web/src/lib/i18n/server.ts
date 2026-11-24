import 'server-only';
import { cookies, headers } from 'next/headers';
import {
  BASELINES,
  EN_NG,
  createMessages,
  effectiveCatalog,
  pseudo,
  type CatalogShape,
  type DbRow,
  type LocaleCode,
  type Translate,
} from '@ad/shared/messages';

/** Approved database rows for a locale. The translation service registers its loader here (slice 8). */
export type OverlayLoader = (locale: LocaleCode) => Promise<ReadonlyMap<string, DbRow>>;
let overlay: OverlayLoader = async () => new Map();
let overlayRegistered = false;
export function registerCatalogOverlay(loader: OverlayLoader): void {
  overlay = loader;
  overlayRegistered = true;
}

/** Called with each key a viewer saw in English instead of their language (slice 11). */
export type MissingSink = (locale: LocaleCode, key: string) => void;
let sink: MissingSink = () => {};
export function registerMissingSink(next: MissingSink): void {
  sink = next;
}

/** The catalog for a locale: baseline JSON with approved database rows over it. Pseudo locale is dev only. */
export async function loadCatalog(locale: LocaleCode): Promise<CatalogShape> {
  if (locale === 'en') return EN_NG as unknown as CatalogShape;
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_PSEUDO_LOCALE === 'true' && (locale as string) === 'xx') {
    return Object.fromEntries(Object.entries(EN_NG).map(([k, v]) => [k, pseudo(v as never)])) as CatalogShape;
  }
  // The runtime registers the database overlay the first time it is touched.
  if (!overlayRegistered) await import('./runtime').then((m) => m.i18nRuntime()).catch(() => undefined);
  return effectiveCatalog(BASELINES[locale], await overlay(locale));
}

export async function getTranslator(locale: LocaleCode): Promise<Translate> {
  const catalog = await loadCatalog(locale);
  return createMessages(
    locale,
    { 'en-NG': EN_NG as unknown as CatalogShape, [locale]: catalog },
    (key, loc) => sink(loc as LocaleCode, key),
  );
}

/** The viewer's language: ?lang=, profile, account, cookie, Accept-Language, site default (M46 4.2). */
export async function getLocale(): Promise<LocaleCode> {
  const [{ themeRuntime }, { getSession }, { LOCALE_COOKIE }, { resolveLocale }] = await Promise.all([
    import('../data/admin/theme-runtime'),
    import('../session'),
    import('./cookie'),
    import('./resolve'),
  ]);
  const h = await headers();
  const settings = (await themeRuntime()).settings;
  const enabled: string[] = await settings.get('content.ui_languages');
  const fallback = (await settings.get('content.default_language')) as LocaleCode;
  const hint = h.get('x-ad-locale-source') === 'query' ? h.get('x-ad-locale-hint') : null;
  let profileLanguage: string | null = null;
  try {
    profileLanguage = (await getSession())?.profile?.language ?? null;
  } catch {
    profileLanguage = null;
  }
  return resolveLocale({
    query: hint,
    profileLanguage,
    cookie: (await cookies()).get(LOCALE_COOKIE)?.value,
    acceptLanguage: h.get('accept-language'),
    enabled,
    fallback,
  });
}
