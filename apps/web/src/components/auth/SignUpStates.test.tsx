// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SignUpForm } from './SignUpForm';

/** One test per stacked state of the S02 mockup. */

const scorer = async (pw: string) => (pw.length > 18 ? 4 : 2);

function setup(props: Partial<Parameters<typeof SignUpForm>[0]> = {}) {
  return render(<SignUpForm onSubmit={vi.fn()} onDone={vi.fn()} scorer={scorer} {...props} />);
}

const email = () => screen.getByLabelText(/^Email \(required\)/);
const password = () => screen.getByLabelText(/^Password \(required\)/);
const meter = () => document.querySelector('.auth-meter') as HTMLElement;
const segmentsOn = () => meter().querySelectorAll('.auth-meter__bar span[data-on="true"]').length;

describe('S02 default', () => {
  it('has the mockup copy, an empty four segment meter, the unmet checklist, the terms line and the sticky bar', () => {
    setup();
    expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Choose a password')).toBeInTheDocument();
    expect(meter()).toHaveAttribute('aria-label', 'Password strength: not started');
    expect(meter().querySelectorAll('.auth-meter__bar span')).toHaveLength(4);
    expect(segmentsOn()).toBe(0);
    expect(meter().querySelector('.auth-meter__word')).toHaveTextContent('Strength');
    const items = document.querySelectorAll('.auth-checklist li');
    expect([...items].map((item) => item.textContent)).toEqual([
      'At least 10 characters (not met)',
      'Not a common password (not met)',
      'Better with a mix of words you can remember (hint)',
    ]);
    expect(document.querySelector('.auth-fine')).toHaveTextContent(
      'By creating an account you agree to the Terms and Privacy Policy.',
    );
    const submit = screen.getByRole('button', { name: 'Create account' });
    expect(submit.parentElement).toHaveClass('auth-sticky');
    expect(submit.closest('form')).toHaveClass('auth-form--sticky');
    expect(screen.getByText(/Already have an account\?/)).toHaveClass('auth-alt');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
  });
});

describe('S02 typing, password too short', () => {
  it('shows Weak with two segments and names the fix after leaving the field', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(email(), 'chioma.okafor@gmail.com');
    await user.type(password(), 'lagos2026');
    await waitFor(() =>
      expect(meter().querySelector('.auth-meter__word')).toHaveTextContent('Weak'),
    );
    expect(segmentsOn()).toBe(2);
    expect(meter()).toHaveAttribute('aria-label', 'Password strength: Weak');
    await user.tab();
    await user.tab();
    const message = screen.getByText('Use at least 10 characters.');
    expect(message.closest('.auth-field__error')).toHaveAttribute('role', 'alert');
    expect(password()).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('S02 strong password', () => {
  it('fills the meter, ticks every rule and can show the password', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(password(), 'blue mango river sunrise');
    await waitFor(() =>
      expect(meter().querySelector('.auth-meter__word')).toHaveTextContent('Strong'),
    );
    expect(segmentsOn()).toBe(4);
    expect(meter()).toHaveAttribute('data-tone', 'success');
    const items = [...document.querySelectorAll('.auth-checklist li')];
    expect(items[0]).toHaveAttribute('data-met', 'true');
    expect(items[1]).toHaveAttribute('data-met', 'true');
    expect(items[2]).toHaveAttribute('data-met', 'true');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password()).toHaveAttribute('type', 'text');
  });

  it('reads Okay with three segments for a middling password', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(password(), 'abcdefghijkl');
    await waitFor(() =>
      expect(meter().querySelector('.auth-meter__word')).toHaveTextContent('Okay'),
    );
    expect(segmentsOn()).toBe(3);
    const hint = document.querySelectorAll('.auth-checklist li')[2];
    expect(hint).not.toHaveAttribute('data-met', 'true');
    expect(hint).toHaveTextContent('(hint)');
  });
});

describe('S02 email not valid', () => {
  it('shows the full email hint after leaving the field', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(email(), 'chioma.okafor@gmail');
    await user.tab();
    expect(
      screen.getByText('Enter your full email, for example name@example.com.'),
    ).toBeInTheDocument();
    expect(email()).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('S02 Caps Lock hint', () => {
  it('shows an amber hint while Caps Lock is on', () => {
    setup();
    fireEvent.keyUp(password(), { key: 'A', modifierCapsLock: true });
    expect(screen.getByText('Caps Lock is on').closest('.auth-caps')).not.toBeNull();
  });
});

describe('S02 network error and rate limited', () => {
  async function fail(reason: string) {
    const user = userEvent.setup();
    setup({ onSubmit: vi.fn().mockResolvedValue({ ok: false, reason }) });
    await user.type(email(), 'chioma.okafor@gmail.com');
    await user.type(password(), 'blue mango river sunrise');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
  }

  it('says the details are saved and keeps them', async () => {
    await fail('network');
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(
      'We could not reach the server. Your details are saved here. Check your connection and try again.',
    );
    expect(banner).toHaveAttribute('data-tone', 'danger');
    expect(email()).toHaveValue('chioma.okafor@gmail.com');
  });

  it('gives a plain warning with the wait time', async () => {
    await fail('rate_limited');
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(
      'Too many accounts were created from this connection. Try again in 15 minutes.',
    );
    expect(banner).toHaveAttribute('data-tone', 'warning');
    expect(banner).toHaveAttribute('data-icon', 'clock');
  });
});

describe('S02 invite only variant', () => {
  it('puts the invite code between email and password with the invitation hint and no banner', () => {
    setup({ inviteOnly: true });
    const invite = screen.getByLabelText(/^Invite code \(required\)/);
    expect(screen.getByText('Sign up is by invitation for now.')).toHaveClass('auth-field__hint');
    expect(
      invite.compareDocumentPosition(password()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(email().compareDocumentPosition(invite) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
