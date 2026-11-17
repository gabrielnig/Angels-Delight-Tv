import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, isSecurityAction, SECURITY_PREFIXES } from './query';

describe('cursor', () => {
  it('round trips an id', () => {
    expect(decodeCursor(encodeCursor(1234))).toBe(1234);
  });
  it('rejects tampered or malformed cursors', () => {
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor(Buffer.from('{"id":"x"}').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('{"id":-1}').toString('base64url'))).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });
});

describe('isSecurityAction', () => {
  it('separates security entries from content entries', () => {
    expect(SECURITY_PREFIXES.length).toBeGreaterThan(3);
    expect(isSecurityAction('auth.login.failed')).toBe(true);
    expect(isSecurityAction('account.role_change')).toBe(true);
    expect(isSecurityAction('video.publish')).toBe(false);
    expect(isSecurityAction('theme.publish')).toBe(false);
  });
});
