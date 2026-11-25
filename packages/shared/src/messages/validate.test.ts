import { describe, expect, it } from 'vitest';
import { TAB_LABEL_WARNING, validateTranslation } from './validate';

const en = 'Resumed from {time}';
const check = (
  text: string | Record<string, string>,
  english: string | Record<string, string> = en,
  locale = 'yo',
) => validateTranslation({ locale, english: english as never, text: text as never });

describe('validateTranslation', () => {
  it('accepts a matching translation', () => {
    const r = check('Tún bẹ̀rẹ̀ láti {time}');
    expect(r.errors).toEqual([]);
  });
  it('rejects a translation that drops a placeholder', () => {
    expect(check('Tún bẹ̀rẹ̀').errors).toContain('missing placeholder {time}');
  });
  it('rejects an extra placeholder', () => {
    expect(check('Tún {time} {extra}').errors).toContain('unknown placeholder {extra}');
  });
  it('requires the plural categories the locale uses', () => {
    const english = { one: '{count} video', other: '{count} videos' };
    const ha = check({ other: '{count} bidiyo' }, english, 'ha');
    expect(ha.errors).toContain('missing plural form one');
    expect(check({ other: '{count} fídíò' }, english, 'yo').errors).toEqual([]);
    expect(check('plain', english, 'yo').errors).toContain('a plural text is required');
  });
  it('rejects em and en dashes', () => {
    expect(check(`Bẹ̀rẹ̀ ${String.fromCharCode(0x2013)} {time}`).errors).toContain(
      'contains an en or em dash',
    );
    expect(check(`Bẹ̀rẹ̀ ${String.fromCharCode(0x2014)} {time}`).errors).toContain(
      'contains an en or em dash',
    );
  });
  it('rejects HTML', () => {
    expect(check('<b>Tún</b> {time}').errors).toContain('contains HTML');
  });
  it('rejects an empty text', () => {
    expect(check('   ').errors).toContain('is empty');
  });
  it('normalises to NFC', () => {
    const decomposed = 'ọ {time}';
    const r = check(decomposed);
    expect(r.normalized).toBe('ọ {time}');
  });
  it('warns above 2.5 times the English length', () => {
    const r = check(`${'a'.repeat(60)} {time}`);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toContain('is much longer than the English text');
  });
});

describe('tab bar label cap (L12, S184)', () => {
  const tab = (key: string, text: string) =>
    validateTranslation({
      locale: 'yo',
      english: 'My list of videos' as never,
      text: text as never,
      key,
    });

  it('warns when a tab label is over 12 characters, and does not block saving', () => {
    const r = tab('nav.myList', 'Àtòkọ àwọn fídíò mi');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toContain(TAB_LABEL_WARNING);
  });

  it('accepts exactly 12 characters and counts a letter with a tone mark once', () => {
    expect(tab('nav.browse', 'abcdefghijkl').warnings).toEqual([]);
    expect(tab('nav.home', 'Ọ̀dọ̀ọ̀dọ̀ọ̀dọ̀ọ̀').warnings).toEqual([]);
    expect(tab('nav.browse', 'abcdefghijklm').warnings).toContain(TAB_LABEL_WARNING);
  });

  it('applies only to the four tab keys and stays quiet when no key is given', () => {
    expect(tab('nav.subjects', 'Ìtàkùrọ̀sọ àwọn ẹ̀kọ́').warnings).not.toContain(TAB_LABEL_WARNING);
    expect(check('Àtòkọ àwọn fídíò mi tó gùn jù').warnings).not.toContain(TAB_LABEL_WARNING);
    for (const key of ['nav.home', 'nav.browse', 'nav.search', 'nav.myList'])
      expect(tab(key, 'a'.repeat(13)).warnings).toContain(TAB_LABEL_WARNING);
  });
});
