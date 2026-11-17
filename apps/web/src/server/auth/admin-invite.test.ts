import { TokenRejected } from '@ad/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Inspect = (token: string) => Promise<unknown>;
const staff = vi.hoisted(() => ({ inspectInvite: undefined as unknown as Inspect }));

vi.mock('./runtime', () => ({ authRuntime: () => ({ staff }) }));
vi.mock('./session', () => ({
  clearSessionCookie: vi.fn(),
  getSession: vi.fn(),
  readSessionToken: vi.fn(),
  requestMeta: vi.fn(),
  setSessionCookie: vi.fn(),
}));

const { realInspectInvite } = await import('./admin');

function failWith(error: Error) {
  staff.inspectInvite = async () => {
    throw error;
  };
}

describe('realInspectInvite', () => {
  beforeEach(() => {
    staff.inspectInvite = async () => ({ role: 'editor', existingAccount: false });
  });

  it('returns the invite details for a live token', async () => {
    expect(await realInspectInvite('tok')).toEqual({ role: 'editor', existingAccount: false });
  });

  it.each(['invalid', 'used', 'expired'] as const)(
    'returns null for a %s token',
    async (problem) => {
      failWith(new TokenRejected(problem));
      expect(await realInspectInvite('tok')).toBeNull();
    },
  );

  it('lets a database failure surface instead of showing an invalid invite', async () => {
    failWith(new Error('connection refused'));
    await expect(realInspectInvite('tok')).rejects.toThrow('connection refused');
  });
});
