import localFont from 'next/font/local';
import type { FontKey } from '@ad/ui';

/**
 * Self hosted fonts through next/font. Each family ships latin and latin-ext, and vietnamese where upstream has it.
 * Latin Extended carries the dotted letters, vietnamese the precomposed Yoruba and Igbo vowels. Only the families the theme selects are referenced by a rendered
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
  src: [
    { path: '../fonts/dm-sans-latin-ext-wght-normal.woff2', weight: '100 1000', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
});
const nunito = localFont({
  src: [{ path: '../fonts/nunito-latin-wght-normal.woff2', weight: '200 1000', style: 'normal' }],
  display: 'swap',
});
const nunitoExt = localFont({
  src: [
    { path: '../fonts/nunito-latin-ext-wght-normal.woff2', weight: '200 1000', style: 'normal' },
  ],
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

const spaceGrotesk = localFont({
  src: [
    { path: '../fonts/space-grotesk-latin-wght-normal.woff2', weight: '300 700', style: 'normal' },
  ],
  display: 'swap',
});
const spaceGroteskExt = localFont({
  src: [
    {
      path: '../fonts/space-grotesk-latin-ext-wght-normal.woff2',
      weight: '300 700',
      style: 'normal',
    },
  ],
  display: 'swap',
  preload: false,
});

const interVi = localFont({
  src: [
    { path: '../fonts/inter-vietnamese-wght-normal.woff2', weight: '100 900', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
});
const nunitoVi = localFont({
  src: [
    { path: '../fonts/nunito-vietnamese-wght-normal.woff2', weight: '200 1000', style: 'normal' },
  ],
  display: 'swap',
  preload: false,
});
const loraVi = localFont({
  src: [{ path: '../fonts/lora-vietnamese-wght-normal.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
  preload: false,
});
const spaceGroteskVi = localFont({
  src: [
    {
      path: '../fonts/space-grotesk-vietnamese-wght-normal.woff2',
      weight: '300 700',
      style: 'normal',
    },
  ],
  display: 'swap',
  preload: false,
});

/**
 * Every family lists its faces in stack order: latin, latin-ext, then vietnamese where the upstream family has
 * one (it holds the precomposed Yoruba and Igbo letters). DM Sans and Poppins have no vietnamese subset, so
 * they fall back to the Inter faces for those letters (DEC-L8-08).
 */
const FAMILIES = {
  'space-grotesk': [spaceGrotesk, spaceGroteskExt, spaceGroteskVi],
  inter: [inter, interExt, interVi],
  'dm-sans': [dmSans, dmSansExt],
  nunito: [nunito, nunitoExt, nunitoVi],
  lora: [lora, loraExt, loraVi],
  poppins: [poppins, poppinsExt],
} as const;

/** Languages whose letters only Inter covers in full: Yoruba, Igbo and Hausa (R23, D-169). */
export const INTER_DISPLAY_LANGUAGES = ['yo', 'ig', 'ha'] as const;
const NEEDS_INTER_FALLBACK = new Set<FontKey>(['dm-sans', 'poppins']);

const SANS_FALLBACK =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SERIF_FALLBACK = 'Georgia, "Times New Roman", serif';

export interface FontSelection {
  /** Classes that make Next emit the @font-face rules for the selected families. */
  classNames: string;
  /** Inline custom properties for the html element. */
  variables: Record<string, string>;
}

type Face = { className: string; style: { fontFamily: string } };

/** Lora and Space Grotesk are display only, body text keeps Inter (docs/DESIGN-SYSTEM.md 5.1, same rule as @ad/theme). */
export function selectFonts(fontKey: FontKey, lang = 'en'): FontSelection {
  const displayOnly = fontKey === 'lora' || fontKey === 'space-grotesk';
  const sansKey: Exclude<FontKey, 'lora' | 'space-grotesk'> = displayOnly ? 'inter' : fontKey;
  const interDisplay = (INTER_DISPLAY_LANGUAGES as readonly string[]).includes(lang);
  const classes = new Set<string>();
  const stack = (faces: readonly Face[], fallback: string, withInter: boolean): string => {
    const all: Face[] = [...faces];
    // Inter ext and vietnamese catch the letters the selected family lacks (never the Latin base).
    if (withInter && faces !== FAMILIES.inter) all.push(interExt, interVi);
    for (const face of all) classes.add(face.className);
    return [...all.map((face) => face.style.fontFamily), fallback].join(', ');
  };
  const withInter = interDisplay || NEEDS_INTER_FALLBACK.has(sansKey);
  const variables: Record<string, string> = {
    '--font-sans': stack(FAMILIES[sansKey], SANS_FALLBACK, withInter),
  };
  if (interDisplay) {
    // Headings in these languages use Inter, whatever display family is selected.
    variables['--font-display'] = stack(FAMILIES.inter, SANS_FALLBACK, false);
  } else if (displayOnly) {
    variables['--font-display'] = stack(
      FAMILIES[fontKey as 'lora' | 'space-grotesk'],
      fontKey === 'lora' ? SERIF_FALLBACK : SANS_FALLBACK,
      false,
    );
  }
  return { classNames: [...classes].join(' '), variables };
}
