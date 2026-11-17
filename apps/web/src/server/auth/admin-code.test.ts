import { describe, expect, it } from 'vitest';
import { classifyCode } from './admin-code';

describe('classifyCode', () => {
  it('treats six digits as an authenticator code, ignoring spaces', () => {
    expect(classifyCode('123 456')).toEqual({ kind: 'totp', code: '123456' });
  });
  it('treats ten letters and digits as a recovery code, with or without the dash', () => {
    expect(classifyCode('abcde-12345')).toEqual({ kind: 'recovery', code: 'abcde-12345' });
    expect(classifyCode('ABCDE12345')).toEqual({ kind: 'recovery', code: 'ABCDE12345' });
  });
  it('rejects anything else', () => {
    expect(classifyCode('')).toEqual({ kind: 'invalid' });
    expect(classifyCode('12345')).toEqual({ kind: 'invalid' });
    expect(classifyCode('abc')).toEqual({ kind: 'invalid' });
  });
});
