import { themeVariables, type FontKey } from '@ad/ui';
import { deriveColors } from './derive';
import type { ThemeValues } from './model';

const SERIF_STACK = '"Lora", Georgia, "Times New Roman", serif';

/**
 * Every CSS variable a theme sets. The themeable subset goes through the validator in @ad/ui, so a value
 * that is not hex, an allowed font key or a bounded number can never reach a style block.
 * Fixed tokens (status, sidebar, player) are never emitted, so a theme cannot change them.
 */
export function buildThemeVariables(theme: ThemeValues): Record<string, string> {
  const vars = themeVariables({
    colors: theme.colors,
    // Lora is display only (docs/DESIGN-SYSTEM.md 5.1): body text keeps Inter.
    fontKey: (theme.fontKey === 'lora' ? 'inter' : theme.fontKey) as FontKey,
    typeScale: theme.typeScale,
    radiusScale: theme.radiusScale,
    density: theme.density,
  });
  if (theme.fontKey === 'lora') vars['--font-display'] = SERIF_STACK;
  else vars['--font-display'] = 'var(--font-sans)';

  const derived = deriveColors(theme.colors);
  vars['--color-on-primary'] = derived.onPrimary;
  vars['--color-on-accent'] = derived.onAccent;
  vars['--color-primary-hover'] = derived.primaryHover;
  vars['--color-primary-active'] = derived.primaryActive;
  vars['--color-primary-tint'] = derived.primaryTint;
  vars['--color-accent-hover'] = derived.accentHover;
  vars['--color-accent-active'] = derived.accentActive;
  vars['--color-border-strong'] = derived.borderStrong;
  vars['--color-surface-sunken'] = derived.surfaceSunken;
  vars['--color-focus-ring'] = derived.focusRing;
  vars['--color-focus-ring-dark'] = derived.focusRingDark;
  return vars;
}

/** CSS for the inline `<style id="theme">` block. Contains no `<` or `>` by construction. */
export function buildThemeCss(theme: ThemeValues, selector = ':root'): string {
  const lines = Object.entries(buildThemeVariables(theme)).map(
    ([name, value]) => `  ${name}: ${value};`,
  );
  return `${selector} {\n${lines.join('\n')}\n}\n`;
}
