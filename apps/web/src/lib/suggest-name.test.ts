import { describe, expect, it } from 'vitest';
import { suggestProfileName } from './suggest-name';

describe('suggestProfileName', () => {
  it('uses the email prefix with a capital letter', () => {
    expect(suggestProfileName('adaeze.okafor@example.com')).toBe('Adaeze Okafor');
  });
  it('drops digits and plus tags and keeps it within 20 characters', () => {
    expect(suggestProfileName('tobi+news2026@x.com')).toBe('Tobi');
    expect(suggestProfileName('averyveryverylongemailprefixhere@x.com').length).toBeLessThanOrEqual(20);
  });
  it('returns an empty string when nothing usable is left', () => {
    expect(suggestProfileName('1234@x.com')).toBe('');
    expect(suggestProfileName('')).toBe('');
  });
});
