import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const ds = read('docs/DESIGN-SYSTEM.md');

describe('design doc quotes the values the plan settled (M47-S15)', () => {
  it('names hero interval 10 s and crossfade 350 ms, rotating by default', () => {
    expect(ds).toMatch(/Hero crossfade 350 ?ms/);
    expect(ds).toMatch(/Auto rotate is on, 10 s per slide/);
    expect(ds).not.toMatch(/manual by default/);
  });

  it('quotes fractional columns, the gutter clamp and the 1920 breakpoint', () => {
    expect(ds).toContain('2.3 (base');
    expect(ds).toContain('3.3 (sm)');
    expect(ds).toContain('4.3 (md)');
    expect(ds).toContain('5.3 (lg)');
    expect(ds).toContain('6.3 (xl');
    expect(ds).toContain('clamp(1rem, 4vw, 3.5rem)');
  });

  it('quotes the hover card delay, nav threshold, countdown and hero item count', () => {
    expect(ds).toContain('`--hover-card-delay` | 300ms');
    expect(ds).toMatch(/after 40px scroll/);
    expect(ds).toMatch(/5 second countdown/);
    expect(ds).toMatch(/Carousel: 1 to 5 items/);
    expect(ds).not.toMatch(/poster 2:3 optional later/);
    expect(ds).not.toMatch(/Can be a modal on desktop/);
  });

  it('names the vietnamese subset and the font-mono token row', () => {
    expect(ds).toMatch(/latin, latin-ext and vietnamese/);
    expect(ds).toContain('`--font-mono`');
  });

  it('screen architecture uses the design system breakpoints and columns', () => {
    const sa = read('docs/SCREEN-ARCHITECTURE.md');
    expect(sa).toMatch(/1920/);
    expect(sa).toMatch(/2\.3/);
    expect(sa).not.toMatch(/xs 2\.3, sm 3\.3, md 4\.3, lg 4\.5/);
  });

  it('user story M05-S01 rotates every 10 seconds', () => {
    expect(read('docs/USER-STORIES.md')).toMatch(/they rotate every 10 seconds/);
  });

  it('MODULES lists M47 and USER-STORIES has M47-S01 to M47-S16', () => {
    expect(read('docs/MODULES.md')).toMatch(/\| M47 \| Design system tuning and guards/);
    const us = read('docs/USER-STORIES.md');
    for (let i = 1; i <= 16; i += 1) {
      expect(us).toContain(`### M47-S${String(i).padStart(2, '0')} `);
    }
  });

  it('BUILD-PLAN lists the lanes added after phase 4', () => {
    expect(read('docs/BUILD-PLAN.md')).toContain('Lanes added after phase 4');
  });

  it.todo('ai-context decision number equals the highest DECISIONS heading (main session flips this on, R40)');
});
