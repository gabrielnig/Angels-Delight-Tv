import { describe, expect, it } from 'vitest';
import { SCROLL_DELTA, nextBarHidden } from './browse-bar-state';

const base = { hidden: false, y: 500, lastY: 500, stuck: true, locked: false };

describe('phone bar headroom (L11 slice 2)', () => {
  it('hides on scroll down once the stack is stuck', () => {
    expect(nextBarHidden({ ...base, y: 500 + SCROLL_DELTA + 1 })).toBe(true);
  });
  it('returns on scroll up', () => {
    expect(nextBarHidden({ ...base, hidden: true, y: 500 - SCROLL_DELTA - 1 })).toBe(false);
  });
  it('ignores small moves so a jittery thumb does not flicker it', () => {
    expect(nextBarHidden({ ...base, y: 503 })).toBe(false);
    expect(nextBarHidden({ ...base, hidden: true, y: 497 })).toBe(true);
  });
  it('stays visible while it is not stuck yet (top of the page)', () => {
    expect(nextBarHidden({ ...base, stuck: false, y: 600 })).toBe(false);
  });
  it('stays visible while a menu is open or focus is inside it', () => {
    expect(nextBarHidden({ ...base, locked: true, y: 700 })).toBe(false);
  });
});
