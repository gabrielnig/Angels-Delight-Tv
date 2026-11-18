// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SignInForm } from './SignInForm';

/** One test per stacked state of the S01 mockup (desktop and mobile share the same states). */

function setup(props: Partial<Parameters<typeof SignInForm>[0]> = {}) {
  return render(<SignInForm onSubmit={vi.fn()} onDone={vi.fn()} signUpOpen {...props} />);
}

async function submitWith(result: unknown) {
  const user = userEvent.setup();
  const onSubmit = vi.fn().mockResolvedValue(result);
  setup({ onSubmit });
  await user.type(screen.getByLabelText(/^Email/), 'ngozi.eze@gmail.com');
  await user.type(screen.getByLabelText('Password'), 'some-password');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}

describe('S01 default state', () => {
  it('has the mockup placeholders, the eye toggle, the forgot link at the end and the centred sign up line', () => {
    setup();
    expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute('aria-pressed', 'false');
    const forgot = screen.getByRole('link', { name: 'Forgot your password?' });
    expect(forgot).toHaveClass('auth-link');
    expect(forgot.parentElement).toHaveClass('auth-forgot');
    const alt = screen.getByText(/New here\?/);
    expect(alt).toHaveClass('auth-alt');
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveClass('auth-link');
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveClass('ad-btn', 'auth-submit');
  });

  it('toggles the password between hidden and shown', async () => {
    const user = userEvent.setup();
    setup();
    const field = screen.getByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('warns when Caps Lock is on while typing a password', () => {
    setup();
    const field = screen.getByLabelText('Password');
    fireEvent.keyUp(field, { key: 'A', modifierCapsLock: true });
    expect(screen.getByText('Caps Lock is on')).toBeInTheDocument();
    fireEvent.keyUp(field, { key: 'a', modifierCapsLock: false });
    expect(screen.queryByText('Caps Lock is on')).toBeNull();
  });
});

describe('S01 wrong email or password', () => {
  it('shows the generic danger banner and marks only the password field, with no inline message', async () => {
    await submitWith({ ok: false, reason: 'invalid' });
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('That email or password is not right. Check them and try again.');
    expect(banner).toHaveClass('auth-banner');
    expect(banner).toHaveAttribute('data-tone', 'danger');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Email/)).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText(/^Email/)).toHaveValue('ngozi.eze@gmail.com');
    expect(document.querySelectorAll('.auth-field__error')).toHaveLength(0);
  });
});

describe('S01 loading', () => {
  it('locks the button, shows the inline spinner and the word Signing in, and keeps the values', async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => undefined;
    const onSubmit = vi.fn().mockReturnValue(new Promise((resolve) => (release = resolve)));
    setup({ onSubmit });
    await user.type(screen.getByLabelText(/^Email/), 'ngozi.eze@gmail.com');
    await user.type(screen.getByLabelText('Password'), 'some-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const button = screen.getByRole('button', { name: /Signing in/ });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('svg.auth-spinner')).not.toBeNull();
    expect(screen.getByLabelText('Password')).toHaveValue('some-password');
    release({ ok: false, reason: 'invalid' });
  });
});

describe('S01 network error', () => {
  it('shows the unreachable message in a danger banner and keeps the values', async () => {
    await submitWith({ ok: false, reason: 'network' });
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('We could not reach the server. Check your data or Wi-Fi, then try again.');
    expect(banner).toHaveAttribute('data-tone', 'danger');
    expect(screen.getByLabelText('Password')).toHaveValue('some-password');
  });
});

describe('S01 after password reset and session expired', () => {
  it('shows the reset notice as a success status', () => {
    setup({ notice: 'Your password was changed. Sign in with your new password.', noticeTone: 'success' });
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('data-tone', 'success');
    expect(status).toHaveTextContent('Your password was changed. Sign in with your new password.');
  });

  it('shows the session ended notice as an information status', () => {
    setup({ notice: 'Your session ended. Sign in again to keep watching.', noticeTone: 'info' });
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('data-tone', 'info');
    expect(status).toHaveTextContent('Your session ended. Sign in again to keep watching.');
  });
});

describe('S01 sign in unavailable', () => {
  it('fails closed with a warning banner', async () => {
    await submitWith({ ok: false, reason: 'unavailable' });
    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Sign in is temporarily unavailable. Try again in a moment.');
    expect(banner).toHaveAttribute('data-tone', 'warning');
  });
});
