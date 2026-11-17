import type { ThemeColorKey } from '@ad/ui';
import { AA_TEXT, contrastRatio, formatRatio } from './contrast';
import { deriveColors, mix, type DerivedColors } from './derive';
import type { ThemeValues } from './model';

export type CheckLevel = 'pass' | 'warn' | 'block';

export interface ContrastCheck {
  id: string;
  label: string;
  foreground: string;
  background: string;
  ratio: number;
  minimum: number;
  level: CheckLevel;
  /** Editor fields this check belongs to, used to put a badge beside each field. */
  fields: ThemeColorKey[];
  message: string;
  suggestion?: { field: ThemeColorKey; value: string };
}

export interface GateResult {
  checks: ContrastCheck[];
  blockers: ContrastCheck[];
  warnings: ContrastCheck[];
  blocked: boolean;
  /** True when publishing needs the admin to confirm warnings (M18-S02 AC2). */
  requiresAcknowledgement: boolean;
  derived: DerivedColors;
  /** Worst check per colour field. */
  byField: Partial<Record<ThemeColorKey, ContrastCheck>>;
}

/** Below this, button text is close to invisible and the theme cannot be saved (M18-S02 AC3). */
export const EXTREME_FAILURE = 2;

const SEVERITY: Record<CheckLevel, number> = { pass: 0, warn: 1, block: 2 };

/**
 * Finds the nearest colour to `color` that reaches `min` against all `backgrounds`,
 * moving toward black or white (whichever is closer to working).
 */
export function suggestColor(
  color: string,
  backgrounds: readonly string[],
  min: number,
): string | null {
  const reaches = (candidate: string) =>
    backgrounds.every((bg) => (contrastRatio(candidate, bg) ?? 0) >= min);
  for (let step = 1; step <= 100; step += 1) {
    for (const target of ['#000000', '#FFFFFF']) {
      const candidate = mix(color, target, step / 100);
      if (reaches(candidate)) return candidate;
    }
  }
  return null;
}

interface PairSpec {
  id: string;
  label: string;
  foreground: string;
  background: string;
  fields: ThemeColorKey[];
  /** What happens below 4.5. */
  policy: 'text' | 'derived' | 'link';
  suggest?: { field: ThemeColorKey; backgrounds: string[]; value: string };
}

function level(policy: PairSpec['policy'], ratio: number): CheckLevel {
  if (ratio >= AA_TEXT) return 'pass';
  if (policy === 'text') return 'block';
  if (policy === 'derived') return ratio < EXTREME_FAILURE ? 'block' : 'warn';
  return 'warn';
}

function messageFor(spec: PairSpec, ratio: number, result: CheckLevel): string {
  if (result === 'pass') return `${formatRatio(ratio)} passes`;
  const ratioText = formatRatio(ratio);
  if (spec.policy === 'text') {
    return `${spec.label} is ${ratioText}, below the 4.5:1 needed to read comfortably. Make one of the two colours darker or lighter.`;
  }
  if (spec.policy === 'link') {
    return `${spec.label} is ${ratioText}. Links may be hard to read. Darken the colour or publish anyway after confirming.`;
  }
  return result === 'block'
    ? `${spec.label} is ${ratioText}. Below 2:1 the text is almost invisible, so this cannot be saved. Pick a colour with more contrast.`
    : `${spec.label} is ${ratioText}, below the 4.5:1 needed to read comfortably. Pick a colour with more contrast, or publish anyway after confirming.`;
}

/**
 * The save gate of docs/DESIGN-SYSTEM.md 4.3 and decision D-007.
 * - ink and muted on page and card: below 4.5 blocks save and publish.
 * - button text (auto chosen white or ink): below 2 blocks, 2 to 4.5 warns.
 * - primary as link on the page: warns.
 */
export function evaluateTheme(theme: ThemeValues): GateResult {
  const { colors } = theme;
  const derived = deriveColors(colors);
  const pageBackgrounds = [colors.bg, colors.surface];

  const specs: PairSpec[] = [
    {
      id: 'ink-on-bg',
      label: 'Text on page background',
      foreground: colors.ink,
      background: colors.bg,
      fields: ['ink', 'bg'],
      policy: 'text',
      suggest: { field: 'ink', backgrounds: pageBackgrounds, value: colors.ink },
    },
    {
      id: 'ink-on-surface',
      label: 'Text on card surface',
      foreground: colors.ink,
      background: colors.surface,
      fields: ['ink', 'surface'],
      policy: 'text',
      suggest: { field: 'ink', backgrounds: pageBackgrounds, value: colors.ink },
    },
    {
      id: 'muted-on-bg',
      label: 'Muted text on page background',
      foreground: colors.muted,
      background: colors.bg,
      fields: ['muted', 'bg'],
      policy: 'text',
      suggest: { field: 'muted', backgrounds: pageBackgrounds, value: colors.muted },
    },
    {
      id: 'muted-on-surface',
      label: 'Muted text on card surface',
      foreground: colors.muted,
      background: colors.surface,
      fields: ['muted', 'surface'],
      policy: 'text',
      suggest: { field: 'muted', backgrounds: pageBackgrounds, value: colors.muted },
    },
    {
      id: 'on-primary',
      label: 'Button text on Primary',
      foreground: derived.onPrimary,
      background: colors.primary,
      fields: ['primary'],
      policy: 'derived',
      suggest: { field: 'primary', backgrounds: [], value: colors.primary },
    },
    {
      id: 'on-accent',
      label: 'Text on Accent',
      foreground: derived.onAccent,
      background: colors.accent,
      fields: ['accent'],
      policy: 'derived',
      suggest: { field: 'accent', backgrounds: [], value: colors.accent },
    },
    {
      id: 'primary-on-bg',
      label: 'Primary links on page background',
      foreground: colors.primary,
      background: colors.bg,
      fields: ['primary'],
      policy: 'link',
      suggest: { field: 'primary', backgrounds: pageBackgrounds, value: colors.primary },
    },
  ];

  const checks: ContrastCheck[] = specs.map((spec) => {
    const ratio = contrastRatio(spec.foreground, spec.background) ?? 1;
    const result = level(spec.policy, ratio);
    const check: ContrastCheck = {
      id: spec.id,
      label: spec.label,
      foreground: spec.foreground,
      background: spec.background,
      ratio,
      minimum: AA_TEXT,
      level: result,
      fields: spec.fields,
      message: messageFor(spec, ratio, result),
    };
    if (result !== 'pass' && spec.suggest) {
      const suggested = suggestForSpec(spec, colors);
      if (suggested) check.suggestion = { field: spec.suggest.field, value: suggested };
    }
    return check;
  });

  const byField: GateResult['byField'] = {};
  for (const check of checks) {
    for (const field of check.fields) {
      const current = byField[field];
      if (!current || SEVERITY[check.level] > SEVERITY[current.level]) byField[field] = check;
    }
  }

  const blockers = checks.filter((check) => check.level === 'block');
  const warnings = checks.filter((check) => check.level === 'warn');
  return {
    checks,
    blockers,
    warnings,
    blocked: blockers.length > 0,
    requiresAcknowledgement: warnings.length > 0,
    derived,
    byField,
  };
}

function suggestForSpec(spec: PairSpec, colors: ThemeValues['colors']): string | null {
  if (!spec.suggest) return null;
  if (spec.id === 'on-primary') return suggestBackground(colors.primary, ['#FFFFFF', colors.ink]);
  if (spec.id === 'on-accent') return suggestBackground(colors.accent, [colors.ink, '#FFFFFF']);
  return suggestColor(spec.suggest.value, spec.suggest.backgrounds, AA_TEXT);
}

/** Moves `background` toward black or white until one of `texts` reaches 4.5 on it. */
function suggestBackground(background: string, texts: readonly string[]): string | null {
  for (let step = 1; step <= 100; step += 1) {
    for (const target of ['#000000', '#FFFFFF']) {
      const candidate = mix(background, target, step / 100);
      if (texts.some((text) => (contrastRatio(text, candidate) ?? 0) >= AA_TEXT)) return candidate;
    }
  }
  return null;
}
