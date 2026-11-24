import {
  COLOR_KEYS,
  FONT_KEYS,
  ThemeValidationError,
  type Density,
  type FontKey,
  type ThemeColorKey,
  type ThemeIssue,
} from '@ad/ui/theme';
import { normalizeHex } from './contrast';

export interface ThemeValues {
  colors: Record<ThemeColorKey, string>;
  fontKey: FontKey;
  typeScale: number;
  radiusScale: number;
  density: Density;
}

/** Docs/MODULES.md M18 defaults plus the surface and the tokens.css defaults. */
export const DEFAULT_THEME: ThemeValues = {
  colors: {
    bg: '#F5F5F2',
    surface: '#FFFFFF',
    ink: '#1A1C22',
    muted: '#5B606B',
    border: '#DEDDD6',
    primary: '#1F6FB5',
    accent: '#FFC93C',
  },
  fontKey: 'space-grotesk',
  typeScale: 1,
  radiusScale: 1,
  density: 'comfortable',
};

export const COLOR_LABELS: Record<ThemeColorKey, { label: string; hint: string }> = {
  ink: { label: 'Text', hint: 'on page background' },
  bg: { label: 'Page background', hint: 'also used for cards' },
  surface: { label: 'Card surface', hint: 'cards, menus and inputs' },
  muted: { label: 'Muted text', hint: 'captions and secondary text' },
  border: { label: 'Borders', hint: 'dividers and card edges' },
  primary: { label: 'Primary', hint: 'white text on buttons' },
  accent: { label: 'Accent', hint: 'ink text on accent' },
};

/** Order the editor lists the colours in. */
export const COLOR_ORDER: readonly ThemeColorKey[] = [
  'ink',
  'bg',
  'surface',
  'muted',
  'border',
  'primary',
  'accent',
];

export interface FontOption {
  key: FontKey;
  label: string;
  description: string;
}

/** The curated list of D-007. Adding a font needs a logged decision and a self hosted WOFF2 subset. */
export const FONT_OPTIONS: readonly FontOption[] = [
  { key: 'space-grotesk', label: 'Space Grotesk', description: 'Geometric headings, body text stays Inter' },
  { key: 'inter', label: 'Inter', description: 'Neutral, easy to read on small phones' },
  { key: 'dm-sans', label: 'DM Sans', description: 'Geometric and friendly' },
  { key: 'poppins', label: 'Poppins', description: 'Rounded and bold, wider' },
  { key: 'nunito', label: 'Nunito', description: 'Soft and warm' },
  { key: 'lora', label: 'Lora', description: 'Editorial serif, headings only' },
];

export const TYPE_SCALE_OPTIONS = [0.9, 0.95, 1, 1.05, 1.1, 1.15].map((value) => ({
  value,
  label: `${Math.round(16 * value * 10) / 10} px`,
}));

export const RADIUS_OPTIONS = [0, 0.5, 1, 1.5, 2].map((value) => ({
  value,
  label: value === 0 ? 'Square' : `${value * 8} px corners`,
}));

export const DENSITY_OPTIONS: readonly { value: Density; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'spacious', label: 'Roomy' },
];

const TOP_LEVEL_KEYS = ['colors', 'fontKey', 'typeScale', 'radiusScale', 'density'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function onStep(value: number, step: number): boolean {
  const n = value / step;
  return Math.abs(n - Math.round(n)) < 1e-6;
}

/**
 * Validates untrusted theme input (form data or a stored jsonb row) and returns a complete theme.
 * Missing fields take the default. Unknown keys are rejected, never ignored (docs/DESIGN-SYSTEM.md 11.24).
 */
export function parseTheme(input: unknown): ThemeValues {
  if (!isRecord(input)) {
    throw new ThemeValidationError([{ field: '', message: 'theme must be an object' }]);
  }
  const issues: ThemeIssue[] = [];
  for (const key of Object.keys(input)) {
    if (!TOP_LEVEL_KEYS.includes(key)) issues.push({ field: key, message: 'unknown setting' });
  }

  const colors: Record<ThemeColorKey, string> = { ...DEFAULT_THEME.colors };
  const rawColors = input.colors;
  if (rawColors !== undefined) {
    if (!isRecord(rawColors)) {
      issues.push({ field: 'colors', message: 'must be an object' });
    } else {
      for (const [key, value] of Object.entries(rawColors)) {
        if (!(COLOR_KEYS as readonly string[]).includes(key)) {
          issues.push({ field: `colors.${key}`, message: 'not a themeable colour' });
          continue;
        }
        const hex = normalizeHex(value);
        if (hex === null) issues.push({ field: `colors.${key}`, message: 'must be a hex colour' });
        else colors[key as ThemeColorKey] = hex;
      }
    }
  }

  let fontKey = DEFAULT_THEME.fontKey;
  if (input.fontKey !== undefined) {
    if (typeof input.fontKey === 'string' && (FONT_KEYS as string[]).includes(input.fontKey)) {
      fontKey = input.fontKey as FontKey;
    } else issues.push({ field: 'fontKey', message: `must be one of ${FONT_KEYS.join(', ')}` });
  }

  let typeScale = DEFAULT_THEME.typeScale;
  if (input.typeScale !== undefined) {
    const v = input.typeScale;
    if (typeof v === 'number' && v >= 0.9 - 1e-9 && v <= 1.15 + 1e-9 && onStep(v, 0.05)) {
      typeScale = Math.round(v * 100) / 100;
    } else issues.push({ field: 'typeScale', message: 'must be 0.9 to 1.15 in steps of 0.05' });
  }

  let radiusScale = DEFAULT_THEME.radiusScale;
  if (input.radiusScale !== undefined) {
    const v = input.radiusScale;
    if (typeof v === 'number' && v >= 0 && v <= 2) radiusScale = v;
    else issues.push({ field: 'radiusScale', message: 'must be between 0 and 2' });
  }

  let density = DEFAULT_THEME.density;
  if (input.density !== undefined) {
    if (DENSITY_OPTIONS.some((option) => option.value === input.density)) {
      density = input.density as Density;
    } else issues.push({ field: 'density', message: 'must be compact, comfortable or spacious' });
  }

  if (issues.length > 0) throw new ThemeValidationError(issues);
  return { colors, fontKey, typeScale, radiusScale, density };
}

export function themesEqual(a: ThemeValues, b: ThemeValues): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function canonical(theme: ThemeValues) {
  return {
    colors: COLOR_KEYS.map((key) => theme.colors[key]),
    fontKey: theme.fontKey,
    typeScale: theme.typeScale,
    radiusScale: theme.radiusScale,
    density: theme.density,
  };
}
