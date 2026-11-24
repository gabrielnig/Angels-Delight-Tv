import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, scanCss } from './css-scan';

const rules = scanCss(readFileSync(resolve(repoRoot, 'packages/ui/src/components.css'), 'utf8'));
const one = (selector: string, at: (a: string[]) => boolean = (a) => a.length === 0) =>
  rules.find((r) => r.selector.replace(/\s+/g, ' ') === selector && at(r.at));

describe('button size tokens (M47-S08, DEC-L8-02)', () => {
  it('button heights come from the size tokens', () => {
    expect(one('.ad-btn')?.body).toMatch(/min-height:\s*var\(--button-height-md\)/);
    expect(one(".ad-btn[data-size='sm']")?.body).toMatch(/min-height:\s*var\(--button-height-sm\)/);
    expect(one(".ad-btn[data-size='lg']")?.body).toMatch(/min-height:\s*var\(--button-height-lg\)/);
  });

  it('every button keeps a 44px hit area through the before element', () => {
    const before = one('.ad-btn::before');
    expect(before?.body).toMatch(/position:\s*absolute/);
    expect(before?.body).toMatch(/inset:\s*min\(0px, calc\(\(var\(--touch-target\) - 100%\) \/ -2\)\) 0/);
    expect(one('.ad-btn')?.body).toMatch(/position:\s*relative/);
  });

  it('coarse pointers get at least 44px tall buttons', () => {
    const coarse = one(".ad-btn, .ad-btn[data-size='sm']", (a) => a.some((x) => /pointer:\s*coarse/.test(x)));
    expect(coarse?.body).toMatch(/min-height:\s*var\(--touch-target\)/);
  });

  it('press uses the press duration and hover uses the hover tokens', () => {
    expect(one('.ad-btn:active:not(:disabled)')?.body).toMatch(/transition-duration:\s*var\(--motion-press\)/);
    expect(one('.ad-btn')?.body).toMatch(/var\(--motion-hover\) var\(--ease-out-strong\)/);
  });

  it('icon only buttons are 44 by 44', () => {
    const icon = one('.ad-iconbtn')?.body ?? '';
    expect(icon).toMatch(/width:\s*var\(--touch-target\)/);
    expect(icon).toMatch(/height:\s*var\(--touch-target\)/);
  });

  it('buttons in a group sit at least 8px apart', () => {
    expect(one('.ad-btn')?.body).toMatch(/gap:\s*var\(--icon-gap\)/);
    const actions = one('.ad-hero__actions');
    expect(actions?.body ?? '').toMatch(/gap:\s*var\(--space-(2|3|4)\)/);
  });
});
