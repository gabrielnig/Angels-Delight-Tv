// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { LOCALE_STORAGE_KEY, readStoredLocale, rememberLocale } from './stored-locale';

describe('stored locale for the offline page', () => {
  beforeEach(() => localStorage.clear());
  it('uses the key ad:locale', () => {
    expect(LOCALE_STORAGE_KEY).toBe('ad:locale');
  });
  it('remembers and reads a locale', () => {
    rememberLocale('yo');
    expect(readStoredLocale()).toBe('yo');
  });
  it('reads null when nothing is stored', () => {
    expect(readStoredLocale()).toBeNull();
  });
});
