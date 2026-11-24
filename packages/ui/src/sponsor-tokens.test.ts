import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(resolve(import.meta.dirname, 'tokens.css'), 'utf8');
const doc = readFileSync(resolve(import.meta.dirname, '../../../docs/DESIGN-SYSTEM.md'), 'utf8');

const NAMES = [
  '--sponsor-slot-height-compact',
  '--sponsor-slot-height-wide',
  '--sponsor-label-bg',
  '--sponsor-label-ink',
  '--sponsor-label-size',
  '--sponsor-label-height',
];

const lum = (c: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe('sponsor tokens (M48)', () => {
  it.each(NAMES)('defines %s in tokens.css and the design doc', (name) => {
    expect(tokens).toContain(`${name}:`);
    expect(doc).toContain(name);
  });
  it('keeps the label chip at 4.5:1 or more', () => {
    const bg = /--sponsor-label-bg:\s*(#[0-9A-Fa-f]{6})/.exec(tokens)![1]!;
    const ink = /--sponsor-label-ink:\s*(#[0-9A-Fa-f]{6})/.exec(tokens)![1]!;
    const [hi, lo] = [lum(bg), lum(ink)].sort((a, b) => b - a) as [number, number];
    expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
  it('scales the slot heights with the type scale so large text never clips', () => {
    expect(tokens).toMatch(/--sponsor-slot-height-compact:\s*calc\(7rem \* var\(--type-scale\)\)/);
    expect(tokens).toMatch(/--sponsor-slot-height-wide:\s*calc\(8\.5rem \* var\(--type-scale\)\)/);
  });
  it('is not in the themeable group', () => {
    const theme = readFileSync(resolve(import.meta.dirname, 'theme.ts'), 'utf8');
    expect(theme).not.toContain('--sponsor-');
  });
});
