// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ForgotPasswordForm, ResetPasswordForm } from './RecoveryForms';

describe('ForgotPasswordForm', () => {
  it('asks for a valid email before sending', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<ForgotPasswordForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/Email \(required\)/), 'ngozi.eze@gmail');
    await user.click(screen.getByRole('button', { name: 'Send link' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter your full email, for example name@example.com.')).toBeInTheDocument();
  });

  it('shows the same confirmation whatever the email, so it never reveals accounts', async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm onSubmit={vi.fn().mockResolvedValue({ ok: true })} />);
    await user.type(screen.getByLabelText(/Email/), 'anyone@example.com');
    await user.click(screen.getByRole('button', { name: 'Send link' }));
    expect(await screen.findByText('If that email has an account, we sent a link. It works for 1 hour.')).toBeInTheDocument();
    expect(screen.getByText('Not there? Check your spam folder, or try again in a few minutes.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/sign-in');
  });

  it('handles rate limit and network errors', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ForgotPasswordForm onSubmit={vi.fn().mockResolvedValue({ ok: false, reason: 'rate_limited' })} />);
    await user.type(screen.getByLabelText(/Email/), 'a@example.com');
    await user.click(screen.getByRole('button', { name: 'Send link' }));
    expect(await screen.findByText('Too many requests. Try again in 15 minutes.')).toBeInTheDocument();
    rerender(<ForgotPasswordForm key="n" onSubmit={vi.fn().mockRejectedValue(new Error('x'))} />);
    await user.type(screen.getByLabelText(/Email/), 'a@example.com');
    await user.click(screen.getByRole('button', { name: 'Send link' }));
    expect(await screen.findByText(/We could not reach the server/)).toBeInTheDocument();
  });
});

describe('ResetPasswordForm', () => {
  const scorer = async () => 3;

  it('has one password box with a visibility toggle and the explaining hint', () => {
    render(<ResetPasswordForm token="abc" onSubmit={vi.fn()} onDone={vi.fn()} scorer={scorer} />);
    expect(screen.getAllByLabelText(/password/i)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
    expect(screen.getByText('Use the eye button to check what you typed. There is no second box.')).toBeInTheDocument();
  });

  it('names the fix for a short password', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm token="abc" onSubmit={vi.fn()} onDone={vi.fn()} scorer={scorer} />);
    await user.type(screen.getByLabelText(/New password/), 'lagos2026');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(screen.getAllByText('Use at least 10 characters.').length).toBeGreaterThan(0);
  });

  it('saves and continues to sign in', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<ResetPasswordForm token="abc" onSubmit={onSubmit} onDone={onDone} scorer={scorer} />);
    await user.type(screen.getByLabelText(/New password/), 'blue mango river sunrise');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(onSubmit).toHaveBeenCalledWith({ token: 'abc', password: 'blue mango river sunrise' });
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('shows an expired link state with a way to ask again', async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm token="abc" onSubmit={vi.fn().mockResolvedValue({ ok: false, reason: 'expired' })} onDone={vi.fn()} scorer={scorer} />);
    await user.type(screen.getByLabelText(/New password/), 'blue mango river sunrise');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByText('This link has expired')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Send a new link' })).toHaveAttribute('href', '/forgot-password');
  });
});
