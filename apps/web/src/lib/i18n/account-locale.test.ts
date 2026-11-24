import { describe, expect, it } from 'vitest';
import { accountLocaleForResolve } from './account-locale';

describe('accountLocaleForResolve', () => {
  it('treats the column default en as not chosen, so a cookie or Accept-Language still counts', () => {
    expect(accountLocaleForResolve('en')).toBeNull();
  });
  it('passes a chosen locale through and drops unknown codes', () => {
    expect(accountLocaleForResolve('yo')).toBe('yo');
    expect(accountLocaleForResolve('pt-BR')).toBeNull();
    expect(accountLocaleForResolve(undefined)).toBeNull();
  });
});
