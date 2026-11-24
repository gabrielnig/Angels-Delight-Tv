import 'server-only';
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
export function registerCatalogOverlay(loader: OverlayLoader): void {
  overlay = loader;
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
