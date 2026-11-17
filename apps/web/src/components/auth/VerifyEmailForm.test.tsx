// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VerifyEmailForm } from './VerifyEmailForm';

const base = {
  maskedEmail: 'c*****@gmail.com',
  onDone: vi.fn(),
  onResend: vi.fn().mockResolvedValue({ ok: true }),
};

describe('VerifyEmailForm', () => {
  it('shows the masked email and the OTP group label', () => {
    render(<VerifyEmailForm {...base} onSubmit={vi.fn()} />);
    expect(screen.getByText(/c\*{5}@gmail\.com/)).toBeInTheDocument();
    expect(screen.getByLabelText('Enter the 6 digit code we sent to your email')).toHaveAttribute(
      'autocomplete',
      'one-time-code',
    );
  });

  it('submits automatically when the sixth digit is typed and continues on success', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true, next: '/profiles' });
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<VerifyEmailForm {...base} onDone={onDone} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/6 digit code/), '482915');
    expect(onSubmit).toHaveBeenCalledWith({ code: '482915' });
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('/profiles'));
    expect(
      screen.getByText('Email confirmed. Taking you to choose a profile.'),
    ).toBeInTheDocument();
  });

  it('announces a wrong code and lets the user retype', async () => {
    const user = userEvent.setup();
    render(
      <VerifyEmailForm
        {...base}
        onSubmit={vi.fn().mockResolvedValue({ ok: false, reason: 'wrong' })}
      />,
    );
    await user.type(screen.getByLabelText(/6 digit code/), '482916');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That code is not right. Check it and try again.',
    );
    expect(screen.getByLabelText(/6 digit code/)).not.toBeDisabled();
  });

  it('explains an expired code and offers a new one now', async () => {
    const user = userEvent.setup();
    render(
      <VerifyEmailForm
        {...base}
        onSubmit={vi.fn().mockResolvedValue({ ok: false, reason: 'expired' })}
      />,
    );
    await user.type(screen.getByLabelText(/6 digit code/), '482916');
    expect(
      await screen.findByText('This code has expired. Send a new code to continue.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send a new code' })).toBeInTheDocument();
  });

  it('shows the lock after too many wrong codes with a way out', async () => {
    const user = userEvent.setup();
    render(
      <VerifyEmailForm
        {...base}
        onSubmit={vi.fn().mockResolvedValue({ ok: false, reason: 'too_many', minutes: 15 })}
      />,
    );
    await user.type(screen.getByLabelText(/6 digit code/), '482916');
    expect(
      await screen.findByText(
        'Too many wrong codes. Try again in 15 minutes, or change your email.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change email' })).toHaveAttribute('href', '/sign-up');
  });

  it('counts down before resend is possible', () => {
    render(<VerifyEmailForm {...base} onSubmit={vi.fn()} resendSeconds={42} />);
    expect(screen.getByText('Send a new code in 0:42')).toBeInTheDocument();
  });
});
