import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('./components.css');

describe('Breadcrumbs css (R30, R32)', () => {
  it('links are at least 44px wide and tall, the current crumb is an inline-block with a 44px line height', () => {
    expect(css).toMatch(/\.ad-crumbs a \{[^}]*min-width:\s*var\(--touch-target\)[^}]*min-height:\s*var\(--touch-target\)/);
    expect(css).toMatch(/\.ad-crumbs \[aria-current='page'\] \{[^}]*display:\s*inline-block[^}]*line-height:\s*var\(--touch-target\)/);
  });
  it('hover colours sit inside the hover capable query', () => {
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{\s*\.ad-crumbs a:hover/);
  });
});
