import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(resolve(import.meta.dirname, 'tokens.css'), 'utf8');

function hex(name: string): string {
  const m = new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(tokens);
  if (!m) throw new Error(`token ${name} not found`);
  return m[1]!.toUpperCase();
}

function luminance(color: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('player tokens (R34, L4-D18)', () => {
  it('keeps the unfilled seek rail at 3:1 or more on the player surface', () => {
    expect(contrast(hex('--color-player-rail'), hex('--color-player-bg'))).toBeGreaterThanOrEqual(3);
  });

  it('keeps the buffered fill lighter than the rail', () => {
    expect(luminance(hex('--color-player-buffer'))).toBeGreaterThan(luminance(hex('--color-player-rail')));
  });

  it('keeps the played fill readable on the rail', () => {
    expect(contrast(hex('--color-accent'), hex('--color-player-rail'))).toBeGreaterThanOrEqual(3);
  });

  it('defines the border, raised surface and switch off tokens with their documented values', () => {
    expect(hex('--color-player-border')).toBe('#3A3D46');
    expect(hex('--color-player-surface-raised')).toBe('#1B1D24');
    expect(hex('--color-player-switch-off')).toBe('#6E7179');
  });

  it('keeps the switch off track at 3:1 on the raised surface', () => {
    expect(
      contrast(hex('--color-player-switch-off'), hex('--color-player-surface-raised')),
    ).toBeGreaterThanOrEqual(3);
  });
});
