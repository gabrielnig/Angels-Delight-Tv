import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(resolve(import.meta.dirname, 'tokens.css'), 'utf8');
const design = readFileSync(resolve(import.meta.dirname, '../../../docs/DESIGN-SYSTEM.md'), 'utf8');

function hex(name: string): string {
  const m = new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(tokens);
  if (!m) throw new Error(`token ${name} not found`);
  return m[1]!.toUpperCase();
}

function luminance(color: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(color.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('status ink tokens (L3 review F11)', () => {
  it.each(['info', 'success', 'warning'])('%s ink is a token that reads on its tint at 4.5:1 or more', (tone) => {
    expect(contrast(hex(`--color-${tone}-ink`), hex(`--color-${tone}-tint`))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['info', 'success', 'warning'])('%s ink is listed in DESIGN-SYSTEM section 3', (tone) => {
    expect(design).toContain(`--color-${tone}-ink`);
  });
});
