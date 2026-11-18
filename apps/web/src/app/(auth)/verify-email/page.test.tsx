import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
);
const session = vi.hoisted(() => vi.fn());
const pending = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ redirect }));
vi.mock('../../../lib/session', () => ({ getSession: session }));
vi.mock('../../../lib/data', () => ({
  getSite: () => ({ content: async () => ({ platformName: 'AD' }) }),
  getAuth: () => ({ pendingEmail: pending }),
}));
vi.mock('../../../components/AuthLayouts', () => ({ AuthCardPage: () => null }));
vi.mock('../../../components/auth/AuthScreens', () => ({ VerifyScreen: () => null }));

import VerifyEmailPage from './page';

describe('verify email page', () => {
  beforeEach(() => {
    redirect.mockClear();
    session.mockReset();
    pending.mockReset();
  });

  it('sends an account that is already verified to the profile picker', async () => {
    session.mockResolvedValue({ verified: true, email: 'a@b.co' });
    pending.mockResolvedValue(null);
    await expect(VerifyEmailPage()).rejects.toThrow('redirect:/profiles');
  });

  it('sends a visitor with nothing pending to sign in', async () => {
    session.mockResolvedValue(null);
    pending.mockResolvedValue(null);
    await expect(VerifyEmailPage()).rejects.toThrow('redirect:/sign-in');
  });

  it('shows the code screen for an unverified address', async () => {
    session.mockResolvedValue(null);
    pending.mockResolvedValue('a@b.co');
    await expect(VerifyEmailPage()).resolves.toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
});
