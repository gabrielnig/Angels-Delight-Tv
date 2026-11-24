// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GUEST_INTENT_KEY } from '../../lib/guest/intent';
import { SignInToSaveDialog } from './SignInToSaveDialog';

const open = (props: Partial<React.ComponentProps<typeof SignInToSaveDialog>> = {}) => {
  const onClose = vi.fn();
  render(
    <SignInToSaveDialog
      open
      reason="my-list"
      next="/title/how rain is made"
      signUpOpen
      onClose={onClose}
      {...props}
    />,
  );
  return onClose;
};

describe('SignInToSaveDialog (S83)', () => {
  it('explains saving to My List and says watching needs no account', () => {
    open();
    expect(screen.getByRole('dialog', { name: 'Save this to My List' })).toBeInTheDocument();
    expect(screen.getByText(/You can keep watching without one/)).toBeInTheDocument();
  });

  it('has its own copy for a like', () => {
    open({ reason: 'like' });
    expect(screen.getByRole('dialog', { name: 'Save your like' })).toBeInTheDocument();
  });

  it('carries the page to come back to in both links', () => {
    open();
    const next = encodeURIComponent('/title/how rain is made');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      `/sign-in?next=${next}`,
    );
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      `/sign-up?next=${next}`,
    );
  });

  it('hides Create account when sign up is closed', () => {
    open({ signUpOpen: false });
    expect(screen.queryByRole('link', { name: 'Create account' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('closes with Not now and with Escape', async () => {
    const onClose = open();
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders nothing when closed', () => {
    open({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  describe('return intent', () => {
    beforeEach(() => localStorage.clear());

    it('remembers what to save when the visitor goes to sign in', async () => {
      open({ intent: { kind: 'my-list', itemKey: 'video:a' } });
      const link = screen.getByRole('link', { name: 'Sign in' });
      link.addEventListener('click', (event) => event.preventDefault());
      await userEvent.click(link);
      expect(JSON.parse(localStorage.getItem(GUEST_INTENT_KEY)!)).toMatchObject({
        kind: 'my-list',
        itemKey: 'video:a',
      });
    });

    it('stores nothing when the visitor says Not now', async () => {
      open({ intent: { kind: 'my-list', itemKey: 'video:a' } });
      await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
      expect(localStorage.getItem(GUEST_INTENT_KEY)).toBeNull();
    });
  });
});
