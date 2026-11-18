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
  it('treats staff, role, invite and job entries as security (D-125)', () => {
    for (const action of [
      'admin.role_changed',
      'admin.mfa_reset',
      'admin.invite_sent',
      'admin.lockout',
      'admin.account_deletion_requested',
      'staff.invite',
      'role.change',
      'job.retry',
      'job.discard',
    ])
      expect(isSecurityAction(action), action).toBe(true);
    for (const action of ['video.edit', 'caption.review', 'settings.site', 'home.curate'])
      expect(isSecurityAction(action), action).toBe(false);
  });
});
