import { describe, expect, it } from 'vitest';
import { validateTranslation } from './validate';

const en = 'Resumed from {time}';
const check = (text: string | Record<string, string>, english: string | Record<string, string> = en, locale = 'yo') =>
  validateTranslation({ locale, english: english as never, text: text as never });

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
    expect(check(`Bẹ̀rẹ̀ ${String.fromCharCode(0x2013)} {time}`).errors).toContain('contains an en or em dash');
    expect(check(`Bẹ̀rẹ̀ ${String.fromCharCode(0x2014)} {time}`).errors).toContain('contains an en or em dash');
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
