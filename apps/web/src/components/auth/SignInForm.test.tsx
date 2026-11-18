// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignInForm } from './SignInForm';

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  email = 'ngozi@example.com',
  password = 'some-password',
) {
  await user.type(screen.getByLabelText(/^Email/), email);
  await user.type(screen.getByLabelText('Password'), password);
}

interface FakeTurnstile {
  callback?: (token: string) => void;
}
function installTurnstile(): FakeTurnstile {
  const fake: FakeTurnstile = {};
  (window as unknown as { turnstile: unknown }).turnstile = {
    render: (_el: HTMLElement, o: { callback: (t: string) => void }) => {
      fake.callback = o.callback;
      return 'w';
    },
    reset: vi.fn(),
    remove: vi.fn(),
  };
  return fake;
}

describe('SignInForm with Turnstile', () => {
  afterEach(() => {
    delete (window as unknown as { turnstile?: unknown }).turnstile;
  });

  it('shows no check without a site key', () => {
    render(<SignInForm onSubmit={vi.fn()} onDone={vi.fn()} signUpOpen />);
    expect(screen.queryByRole('group', { name: 'Security check' })).toBeNull();
  });

  it('waits for the check, then sends its token once', async () => {
    const fake = installTurnstile();
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, next: '/' });
    const user = userEvent.setup();
    render(<SignInForm onSubmit={onSubmit} onDone={vi.fn()} signUpOpen turnstileSiteKey="site" />);
    expect(screen.getByRole('group', { name: 'Security check' })).toBeInTheDocument();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/security check is still running/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    act(() => fake.callback!('token-1'));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ challengeToken: 'token-1' }));
  });
});

describe('SignInForm', () => {
  it('has labelled email and password fields with the right input hints', () => {
    render(<SignInForm onSubmit={vi.fn()} onDone={vi.fn()} signUpOpen />);
    const email = screen.getByLabelText(/^Email/);
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('inputmode', 'email');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('links to forgot password and sign up', () => {
    render(<SignInForm onSubmit={vi.fn()} onDone={vi.fn()} signUpOpen />);
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/sign-up',
    );
  });

  it('hides the sign up link when sign up is closed', () => {
    render(<SignInForm onSubmit={vi.fn()} onDone={vi.fn()} signUpOpen={false} />);
    expect(screen.queryByRole('link', { name: 'Create an account' })).toBeNull();
  });

  it('validates on submit, names the fix and focuses the first invalid field', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<SignInForm onSubmit={onSubmit} onDone={vi.fn()} signUpOpen />);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/)).toHaveFocus();
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('is lazy then eager: an error clears as soon as it is fixed', async () => {
    const user = userEvent.setup();
    render(<SignInForm onSubmit={vi.fn()} onDone={vi.fn()} signUpOpen />);
    const email = screen.getByLabelText(/^Email/);
    await user.type(email, 'ngozi.eze@gmail');
    await user.tab();
    expect(
      screen.getByText('Enter your full email, for example name@example.com.'),
    ).toBeInTheDocument();
    await user.type(email, '.com');
    expect(screen.queryByText('Enter your full email, for example name@example.com.')).toBeNull();
  });

  it('submits trimmed values, locks the button while loading and calls onDone with the destination', async () => {
    let resolve: (value: { ok: true; next: string }) => void = () => {};
    const onSubmit = vi.fn(() => new Promise<{ ok: true; next: string }>((r) => (resolve = r)));
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<SignInForm onSubmit={onSubmit} onDone={onDone} next="/my-list" signUpOpen />);
    await fill(user, ' ngozi@example.com ');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'ngozi@example.com',
      password: 'some-password',
      next: '/my-list',
    });
    expect(screen.getByRole('button', { name: /Signing in/ })).toHaveAttribute('aria-busy', 'true');
    resolve({ ok: true, next: '/my-list' });
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('/my-list'));
  });

  it('shows one generic message for wrong credentials and keeps the values', async () => {
    const user = userEvent.setup();
    render(
      <SignInForm
        onSubmit={vi.fn().mockResolvedValue({ ok: false, reason: 'invalid' })}
        onDone={vi.fn()}
        signUpOpen
      />,
    );
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email or password is not right. Check them and try again.',
    );
    expect(screen.getByLabelText(/^Email/)).toHaveValue('ngozi@example.com');
    expect(screen.getByLabelText('Password')).toHaveValue('some-password');
  });

  it('shows the network message and keeps values', async () => {
    const user = userEvent.setup();
    render(
      <SignInForm
        onSubmit={vi.fn().mockRejectedValue(new Error('offline'))}
        onDone={vi.fn()}
        signUpOpen
      />,
    );
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not reach the server. Check your data or Wi-Fi, then try again.',
    );
  });

  it('shows a lockout with minutes and a disabled button', async () => {
    const user = userEvent.setup();
    render(
      <SignInForm
        onSubmit={vi.fn().mockResolvedValue({ ok: false, reason: 'locked', minutes: 12 })}
        onDone={vi.fn()}
        signUpOpen
      />,
    );
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText(/Too many attempts\. Try again in 12 minutes\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reset your password' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.getByRole('button', { name: 'Try again in 12 min' })).toBeDisabled();
  });

  it('fails closed with a plain message when sign in is unavailable', async () => {
    const user = userEvent.setup();
    render(
      <SignInForm
        onSubmit={vi.fn().mockResolvedValue({ ok: false, reason: 'unavailable' })}
        onDone={vi.fn()}
        signUpOpen
      />,
    );
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByText('Sign in is temporarily unavailable. Try again in a moment.'),
    ).toBeInTheDocument();
  });

  it('asks for a security check before a hard block and sends the token on retry', async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, reason: 'check_required' })
      .mockResolvedValue({ ok: true, next: '/' });
    const user = userEvent.setup();
    render(<SignInForm onSubmit={onSubmit} onDone={vi.fn()} signUpOpen />);
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/Complete the check below/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'I am a person' }));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSubmit).toHaveBeenLastCalledWith(
      expect.objectContaining({ challengeToken: 'checked' }),
    );
  });

  it('shows a success notice passed from password reset', () => {
    render(
      <SignInForm
        onSubmit={vi.fn()}
        onDone={vi.fn()}
        signUpOpen
        notice="Your password was changed. Sign in with your new password."
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Your password was changed.');
  });
});

describe('SignInForm layout hooks (S01)', () => {
  it('marks the forgot password link as end aligned', () => {
    render(<SignInForm onSubmit={vi.fn()} onDone={vi.fn()} signUpOpen />);
    const link = screen.getByRole('link', { name: 'Forgot your password?' });
    expect(link).toHaveClass('auth-link');
    expect(link.parentElement).toHaveClass('auth-forgot');
  });
});
