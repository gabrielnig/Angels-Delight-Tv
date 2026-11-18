/**
 * Turns stored theme tokens (docs/DATA-MODEL.md theme_settings.tokens) into CSS variable overrides.
 * Only the themeable group from tokens.css can change. Values are validated and never passed through as raw CSS.
 */

export const COLOR_KEYS = ['bg', 'surface', 'ink', 'muted', 'border', 'primary', 'accent'] as const;
export type ThemeColorKey = (typeof COLOR_KEYS)[number];

const FONT_STACKS = {
  'space-grotesk':
    '"Space Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  inter:
    '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  'dm-sans':
    '"DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  poppins:
    '"Poppins", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  nunito:
    '"Nunito", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  lora: '"Lora", Georgia, "Times New Roman", serif',
} as const;

export type FontKey = keyof typeof FONT_STACKS;
export const FONT_KEYS = Object.keys(FONT_STACKS) as FontKey[];

const ROW_GAP = {
  compact: 'var(--space-6)',
  comfortable: 'var(--space-8)',
  spacious: 'var(--space-12)',
} as const;

export type Density = keyof typeof ROW_GAP;

export interface ThemeTokens {
  colors?: Partial<Record<ThemeColorKey, string>>;
  fontKey?: FontKey;
  /** 0.9 to 1.15, multiplies the type scale. */
  typeScale?: number;
  /** 0 to 2, multiplies the default corner radii. */
  radiusScale?: number;
  density?: Density;
}

export interface ThemeIssue {
  field: string;
  message: string;
}

export class ThemeValidationError extends Error {
  constructor(readonly issues: ThemeIssue[]) {
    super(
      `Invalid theme: ${issues.map((issue) => `${issue.field} (${issue.message})`).join(', ')}`,
    );
    this.name = 'ThemeValidationError';
  }
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const RADII_REM = {
  '--radius-xs': 0.25,
  '--radius-sm': 0.5,
  '--radius-md': 0.75,
  '--radius-lg': 1,
} as const;

const rem = (value: number) => `${Number(value.toFixed(4))}rem`;

export function themeVariables(tokens: ThemeTokens): Record<string, string> {
  const issues: ThemeIssue[] = [];
  const vars: Record<string, string> = {};

  const colors: Partial<Record<string, string>> = tokens.colors ?? {};
  for (const key of Object.keys(colors)) {
    if (!(COLOR_KEYS as readonly string[]).includes(key)) {
      issues.push({ field: `colors.${key}`, message: 'not a themeable colour' });
    }
  }
  for (const key of COLOR_KEYS) {
    const value = colors[key];
    if (value === undefined) continue;
    if (!HEX_COLOR.test(value)) issues.push({ field: `colors.${key}`, message: 'must be #RRGGBB' });
    else vars[`--color-${key}`] = value.toUpperCase();
  }

  if (tokens.fontKey !== undefined) {
    if (FONT_KEYS.includes(tokens.fontKey)) vars['--font-sans'] = FONT_STACKS[tokens.fontKey];
    else issues.push({ field: 'fontKey', message: `must be one of ${FONT_KEYS.join(', ')}` });
  }

  if (tokens.typeScale !== undefined) {
    if (tokens.typeScale >= 0.9 && tokens.typeScale <= 1.15)
      vars['--type-scale'] = String(tokens.typeScale);
    else issues.push({ field: 'typeScale', message: 'must be between 0.9 and 1.15' });
  }

  if (tokens.radiusScale !== undefined) {
    if (tokens.radiusScale >= 0 && tokens.radiusScale <= 2) {
      for (const [name, base] of Object.entries(RADII_REM))
        vars[name] = rem(base * tokens.radiusScale);
    } else {
      issues.push({ field: 'radiusScale', message: 'must be between 0 and 2' });
    }
  }

  if (tokens.density !== undefined) {
    if (tokens.density in ROW_GAP) vars['--row-gap'] = ROW_GAP[tokens.density];
    else issues.push({ field: 'density', message: 'must be compact, comfortable or spacious' });
  }

  if (issues.length > 0) throw new ThemeValidationError(issues);
  return vars;
}

/** CSS for a style block. Returns an empty string when the theme overrides nothing. */
export function renderThemeCss(tokens: ThemeTokens, selector = ':root'): string {
  const entries = Object.entries(themeVariables(tokens));
  if (entries.length === 0) return '';
  return `${selector} {\n${entries.map(([name, value]) => `  ${name}: ${value};`).join('\n')}\n}\n`;
}
