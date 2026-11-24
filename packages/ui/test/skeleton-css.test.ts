import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, scanCss } from './css-scan';

const rules = scanCss(readFileSync(resolve(repoRoot, 'packages/ui/src/components.css'), 'utf8'));
const flat = (b?: string) => (b ?? '').replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');
const body = (s: string) => rules.find((r) => r.selector === s && r.at.length === 0)?.body;

describe('skeleton parity (M47-S12, F5)', () => {
  it('a skeleton card has the same flex basis expression as a real row item', () => {
    const item = flat(body('.ad-row__item')).match(/flex: 0 0 (var\(.*\));/)?.[1];
    const skel = flat(body('.ad-skelcard')).match(/flex: 0 0 (var\(.*\));/)?.[1];
    expect(item).toBeTruthy();
    expect(skel).toBe(item);
  });

  it('the skeleton row has the page gutter padding and scroll gap like the list', () => {
    const row = flat(body('.ad-skelrow'));
    expect(row).toMatch(/padding: var\(--space-1\) var\(--page-gutter\)/);
    expect(row).toMatch(/gap: var\(--card-gap\)/);
  });

  it('thumb uses the card ratio and bars take the real text line heights', () => {
    expect(body('.ad-skelcard__thumb')).toMatch(/aspect-ratio:\s*var\(--ratio-video\)/);
    expect(flat(body('.ad-skelcard__title'))).toContain(
      'height: calc(var(--text-small) * var(--leading-snug))',
    );
    expect(flat(body('.ad-skelcard__meta'))).toContain(
      'height: calc(var(--text-caption) * var(--leading-snug))',
    );
  });

  it('the hero skeleton keeps both hero ratios', () => {
    expect(body('.ad-hero--skeleton')).toBeDefined();
    const desktop = rules.find(
      (r) => r.selector === '.ad-hero__skeleton-box' && r.at.some((a) => /960px/.test(a)),
    );
    expect(desktop?.body).toMatch(/aspect-ratio:\s*var\(--ratio-hero\)/);
  });
});
