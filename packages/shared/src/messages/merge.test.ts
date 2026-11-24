import { describe, expect, it, vi } from 'vitest';
import { resolveText, type DbRow } from './merge';

const english = { 'a.b': 'English text', 'a.c': 'Other' };
const row = (status: DbRow['status'], text: string): DbRow => ({ status, text });

describe('resolveText', () => {
  it('approved DB text beats baseline JSON beats English', () => {
    const baseline = { 'a.b': 'Baseline' };
    const db = new Map([['a.b', row('approved', 'From db')]]);
    expect(resolveText('a.b', { english, baseline, db }).text).toBe('From db');
    expect(resolveText('a.b', { english, baseline, db: new Map() }).text).toBe('Baseline');
    expect(resolveText('a.b', { english, baseline: {}, db: new Map() }).text).toBe('English text');
  });
  it('draft and in review DB text is ignored', () => {
    const baseline = { 'a.b': 'Baseline' };
    for (const status of ['draft', 'in_review'] as const) {
      const db = new Map([['a.b', row(status, 'Not yet')]]);
      expect(resolveText('a.b', { english, baseline, db }).text).toBe('Baseline');
    }
  });
  it('missing everywhere returns English and records the key', () => {
    const onMissing = vi.fn();
    const r = resolveText('a.c', { english, baseline: {}, db: new Map(), onMissing });
    expect(r).toEqual({ text: 'Other', source: 'english' });
    expect(onMissing).toHaveBeenCalledWith('a.c');
  });
});
