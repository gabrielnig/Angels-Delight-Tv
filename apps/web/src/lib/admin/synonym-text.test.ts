import { describe, expect, it } from 'vitest';
import { dayLabel, groupsToText } from './synonym-format';
import { checkSynonymText } from './synonym-text';

describe('checkSynonymText (M45-S08, S137 state 4)', () => {
  it('accepts one group per line and returns the groups', () => {
    const r = checkSynonymText('money, finance, cash, budget\nfarm, farming, agriculture');
    expect(r.errors).toEqual([]);
    expect(r.groups).toEqual([
      ['money', 'finance', 'cash', 'budget'],
      ['farm', 'farming', 'agriculture'],
    ]);
  });

  it('names the line of a group with one word', () => {
    const r = checkSynonymText('money, finance\nfarm, farming\nsaving');
    expect(r.errors).toEqual([{ line: 3, message: 'Add at least two different words, like "saving, savings".' }]);
  });

  it('says which word is listed twice, in the line it is on', () => {
    const r = checkSynonymText('money, finance\nschool, class, lesson, school');
    expect(r.errors).toEqual([{ line: 2, message: '"school" is listed twice.' }]);
  });

  it('counts lines including blank ones and still reports every bad line', () => {
    const r = checkSynonymText('a, b\n\nsolo\nx, y, x\nok, fine');
    expect(r.errors.map((e) => e.line)).toEqual([3, 4]);
    expect(r.groups).toEqual([
      ['a', 'b'],
      ['ok', 'fine'],
    ]);
  });

  it('refuses markup and symbols with the parser message', () => {
    const r = checkSynonymText('<b>x</b>, y');
    expect(r.errors[0]?.line).toBe(1);
    expect(r.errors[0]?.message).toMatch(/letters and numbers/);
  });

  it('treats accents and case as the same word when it looks for repeats', () => {
    expect(checkSynonymText('Café, cafe, tea').errors).toEqual([{ line: 1, message: '"cafe" is listed twice.' }]);
  });

  it('is fine with an empty list, which clears every group', () => {
    expect(checkSynonymText('  \n ')).toEqual({ groups: [], errors: [] });
  });
});

describe('groupsToText', () => {
  it('writes one comma separated group per line', () => {
    expect(groupsToText([['a', 'b'], ['c', 'd', 'e']])).toBe('a, b\nc, d, e');
    expect(groupsToText([])).toBe('');
  });
});

describe('dayLabel (Lagos days)', () => {
  const now = new Date('2026-11-24T10:00:00Z');
  it('says Today and Yesterday', () => {
    expect(dayLabel(new Date('2026-11-24T00:30:00Z'), now)).toBe('Today');
    expect(dayLabel(new Date('2026-11-23T12:00:00Z'), now)).toBe('Yesterday');
  });
  it('writes older days as day month year', () => {
    expect(dayLabel(new Date('2026-11-22T12:00:00Z'), now)).toBe('22 Nov 2026');
  });
  it('uses the Lagos calendar day, which is one hour ahead of UTC', () => {
    expect(dayLabel(new Date('2026-11-23T23:30:00Z'), now)).toBe('Today');
  });
});
