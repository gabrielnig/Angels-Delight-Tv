import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('docs allow the labelled sponsor slots and donations, off by default (M48)', () => {
  it('PRD section 4 no longer forbids payments and ads outright', () => {
    const prd = read('docs/PRD.md');
    expect(prd).not.toContain('No subscriptions, payments, plans, coupons or ads.');
    expect(prd).toContain('No subscriptions to watch, no paywall and no third party ads.');
    expect(prd).toContain('off by default');
  });

  it('PRD section 12 keeps card data off our servers', () => {
    const prd = read('docs/PRD.md');
    expect(prd).not.toContain('No payment processing and therefore no PCI scope.');
    expect(prd).toContain('Card data never touches our servers');
    expect(prd).toContain('SAQ A');
  });

  it('SECURITY section 12 allows first party sponsor cards only', () => {
    const sec = read('docs/SECURITY.md');
    expect(sec).not.toContain('- No advertising, no third-party trackers, no social features.');
    expect(sec).toContain('First party sponsor cards only');
    expect(sec).toContain('never on kids profiles or Kids mode');
    expect(sec).toContain('The CSP is unchanged');
  });

  it('DESIGN-SYSTEM last rule names the only allowed exceptions', () => {
    const ds = read('docs/DESIGN-SYSTEM.md');
    expect(ds).not.toContain("Don't add payment, subscription, ad or upsell UI. The platform is free.");
    expect(ds).toContain('except the labelled sponsor slots and the Donate page defined in M48');
    expect(ds).toContain('Never on kids profiles.');
  });

  it('DESIGN-SYSTEM lists the sponsor tokens as fixed', () => {
    const ds = read('docs/DESIGN-SYSTEM.md');
    for (const token of [
      '--sponsor-slot-height-compact',
      '--sponsor-slot-height-wide',
      '--sponsor-label-bg',
      '--sponsor-label-ink',
      '--sponsor-label-size',
      '--sponsor-label-height',
    ]) {
      expect(ds, token).toContain(token);
    }
  });

  it('MODULES has an M48 block and USER-STORIES has all 44 stories', () => {
    expect(read('docs/MODULES.md')).toMatch(/### M48 Sponsors and donations/);
    const stories = read('docs/USER-STORIES.md');
    for (let n = 1; n <= 44; n += 1) {
      expect(stories, `S${n}`).toContain(`### M48-S${String(n).padStart(2, '0')} `);
    }
  });

  it('DECISIONS records the M48 decisions with real D numbers', () => {
    const decisions = read('docs/DECISIONS.md');
    for (const tag of ['L9-D01', 'L9-D10', 'L9-D20', 'L9-D21']) {
      expect(decisions, tag).toContain(tag);
    }
  });
});
