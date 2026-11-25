import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SETTING_KEYS } from '../../packages/theme/src/settings-registry';
import { orderedKeys, R04_PATH, renderR04, stepFor, whereIs } from './settings-reference';

describe('settings dictionary R04', () => {
  it('explains every key in the registry exactly once', () => {
    expect(orderedKeys().sort()).toEqual([...SETTING_KEYS].sort());
  });
  it('gives every key a screen or says there is none', () => {
    for (const k of SETTING_KEYS) expect(whereIs(k).length).toBeGreaterThan(5);
  });
  it('keeps every step to 25 words and free of dashes', () => {
    for (const k of SETTING_KEYS) {
      const { line } = stepFor(k);
      expect(line.replace(/\*\*/g, '').split(/\s+/).length, k).toBeLessThanOrEqual(25);
      expect(line + stepFor(k).note, k).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`));
    }
  });
  it('matches the article on disk', () => {
    expect(existsSync(R04_PATH)).toBe(true);
    expect(readFileSync(R04_PATH, 'utf8')).toBe(renderR04());
  });
});
