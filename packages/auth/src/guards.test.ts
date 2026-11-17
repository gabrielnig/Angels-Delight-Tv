import { Forbidden, Unauthorized } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { assertAdmin, assertStaff } from './guards';
import type { SessionContext } from './sessions';

const context = (overrides: Partial<SessionContext> = {}): SessionContext => ({
  sessionId: 's',
  accountId: 'a',
  role: 'admin',
  status: 'active',
  emailVerified: true,
  mfaVerified: true,
  reauthAt: null,
  idleExpiresAt: new Date(),
  absoluteExpiresAt: new Date(),
  ...overrides,
});

describe('assertStaff', () => {
  it('passes an editor or admin session that finished the second factor', () => {
    expect(() => assertStaff(context({ role: 'editor' }))).not.toThrow();
    expect(() => assertStaff(context({ role: 'admin' }))).not.toThrow();
  });

  it('rejects no session with 401', () => {
    expect(() => assertStaff(null)).toThrow(Unauthorized);
  });

  it('rejects a viewer and a staff session without the second factor with 403', () => {
    expect(() => assertStaff(context({ role: 'viewer' }))).toThrow(Forbidden);
    expect(() => assertStaff(context({ mfaVerified: false }))).toThrow(Forbidden);
  });

  it('rejects an unknown role', () => {
    expect(() => assertStaff(context({ role: 'owner' as never }))).toThrow(Forbidden);
  });
});

describe('assertAdmin', () => {
  it('passes admin only', () => {
    expect(() => assertAdmin(context({ role: 'admin' }))).not.toThrow();
    expect(() => assertAdmin(context({ role: 'editor' }))).toThrow(Forbidden);
  });
});
