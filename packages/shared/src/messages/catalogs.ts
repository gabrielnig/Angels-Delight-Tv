/** Committed baseline catalogs per locale. Empty until a native speaker has reviewed text (D-270). */
import ha from './locales/ha.json';
import ig from './locales/ig.json';
import pcm from './locales/pcm.json';
import yo from './locales/yo.json';
import type { LocaleCode } from './locales';
import type { CatalogShape } from './messages';

export const BASELINES: Record<Exclude<LocaleCode, 'en'>, CatalogShape> = {
  yo: yo as CatalogShape,
  ig: ig as CatalogShape,
  ha: ha as CatalogShape,
  pcm: pcm as CatalogShape,
};
