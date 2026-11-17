import localFont from 'next/font/local';
import type { FontKey } from '@ad/ui';

/**
 * Self hosted fonts through next/font. Each family ships two Latin subsets (basic Latin and Latin Extended,
 * which carries the Yoruba and Igbo marks). Only the families the theme selects are referenced by a rendered
 * class, so only those @font-face rules and preload links reach the page.
 */
const inter = localFont({
  src: [{ path: '../fonts/inter-latin-wght-normal.woff2', weight: '100 900', style: 'normal' }],
  display: 'swap',
});
const interExt = localFont({
  src: [{ path: '../fonts/inter-latin-ext-wght-normal.woff2', weight: '100 900', style: 'normal' }],
  display: 'swap',
  preload: false,
});
const dmSans = localFont({
  src: [{ path: '../fonts/dm-sans-latin-wght-normal.woff2', weight: '100 1000', style: 'normal' }],
  display: 'swap',
});
const dmSansExt = localFont({
  src: [{ path: '../fonts/dm-sans-latin-ext-wght-normal.woff2', weight: '100 1000', style: 'normal' }],
  display: 'swap',
  preload: false,
});
const nunito = localFont({
  src: [{ path: '../fonts/nunito-latin-wght-normal.woff2', weight: '200 1000', style: 'normal' }],
  display: 'swap',
});
const nunitoExt = localFont({
  src: [{ path: '../fonts/nunito-latin-ext-wght-normal.woff2', weight: '200 1000', style: 'normal' }],
  display: 'swap',
  preload: false,
});
const lora = localFont({
  src: [{ path: '../fonts/lora-latin-wght-normal.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
});
const loraExt = localFont({
  src: [{ path: '../fonts/lora-latin-ext-wght-normal.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
});
const poppins = localFont({
  src: [
    { path: '../fonts/poppins-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/poppins-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/poppins-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/poppins-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
});
const poppinsExt = localFont({
  src: [
    { path: '../fonts/poppins-latin-ext-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/poppins-latin-ext-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/poppins-latin-ext-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/poppins-latin-ext-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
});

const FAMILIES = {
  inter: [inter, interExt],
  'dm-sans': [dmSans, dmSansExt],
  nunito: [nunito, nunitoExt],
  lora: [lora, loraExt],
  poppins: [poppins, poppinsExt],
} as const;

const SANS_FALLBACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SERIF_FALLBACK = 'Georgia, "Times New Roman", serif';

export interface FontSelection {
  /** Classes that make Next emit the @font-face rules for the selected families. */
  classNames: string;
  /** Inline custom properties for the html element. */
  variables: Record<string, string>;
}

/** Lora is display only, body text keeps Inter (docs/DESIGN-SYSTEM.md 5.1, same rule as @ad/theme). */
export function selectFonts(fontKey: FontKey): FontSelection {
  const sansKey: Exclude<FontKey, 'lora'> = fontKey === 'lora' ? 'inter' : fontKey;
  const [sans, sansExt] = FAMILIES[sansKey];
  const classes = new Set<string>([sans.className, sansExt.className]);
  const variables: Record<string, string> = {
    '--font-sans': `${sans.style.fontFamily}, ${sansExt.style.fontFamily}, ${SANS_FALLBACK}`,
  };
  if (fontKey === 'lora') {
    const [serif, serifExt] = FAMILIES.lora;
    classes.add(serif.className);
    classes.add(serifExt.className);
    variables['--font-display'] = `${serif.style.fontFamily}, ${serifExt.style.fontFamily}, ${SERIF_FALLBACK}`;
  }
  return { classNames: [...classes].join(' '), variables };
}
