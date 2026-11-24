// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  clear: vi.fn(() => true),
  order: [] as string[],
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (to: string) => {
      mocks.order.push('push');
      mocks.push(to);
    },
    refresh: mocks.refresh,
  }),
}));
vi.mock('../../app/actions', () => ({
  requestResetAction: vi.fn(),
  resendCodeAction: vi.fn(),
  resetPasswordAction: vi.fn(),
  signInAction: vi.fn(),
  signUpAction: vi.fn(),
  verifyEmailAction: vi.fn(),
}));
vi.mock('../../lib/pwa/purge', () => ({
  clearServiceWorkerCaches: () => {
    mocks.order.push('clear');
    return mocks.clear();
  },
}));
vi.mock('./SignInForm', () => ({
  SignInForm: ({ onDone }: { onDone: (to: string) => void }) => (
    <button onClick={() => onDone('/my-list')}>done</button>
  ),
}));

import { SignInScreen } from './AuthScreens';

describe('SignInScreen', () => {
  it('clears service worker caches before it leaves the guest session behind', async () => {
    render(<SignInScreen signUpOpen />);
    await userEvent.click(screen.getByRole('button', { name: 'done' }));
    expect(mocks.clear).toHaveBeenCalledTimes(1);
    expect(mocks.order).toEqual(['clear', 'push']);
    expect(mocks.push).toHaveBeenCalledWith('/my-list');
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
