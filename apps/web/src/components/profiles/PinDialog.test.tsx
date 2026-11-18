// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SelectProfileResult } from '../../lib/data';
import { PinDialog } from './PinDialog';

function setup(
  submit: (input: unknown) => Promise<SelectProfileResult> = vi.fn(async () => ({
    ok: true as const,
  })),
) {
  const onUnlocked = vi.fn();
  const onClose = vi.fn();
  render(
    <PinDialog
      open
      profileName="Emeka"
      onSubmit={submit}
      onUnlocked={onUnlocked}
      onClose={onClose}
    />,
  );
  return { submit, onUnlocked, onClose };
}

describe('PinDialog', () => {
  it('asks for the 4 digit PIN of the named profile with a numeric keypad', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Enter PIN for Emeka' })).toBeInTheDocument();
    const input = screen.getByLabelText(/4 digit PIN for Emeka/);
    expect(input).toHaveAttribute('inputmode', 'numeric');
  });

  it('submits as soon as the fourth digit is typed and unlocks on success', async () => {
    const { submit, onUnlocked } = setup();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/4 digit PIN/), '4821');
    expect(submit).toHaveBeenCalledWith({ pin: '4821' });
    await vi.waitFor(() => expect(onUnlocked).toHaveBeenCalled());
  });

  it('says the PIN is wrong, clears it and lets the person try again', async () => {
    const submit = vi.fn(async () => ({ ok: false as const, reason: 'pin_invalid' as const }));
    setup(submit);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/4 digit PIN/), '0000');
    expect(await screen.findByText(/That PIN is not right/)).toBeInTheDocument();
    expect(screen.getByLabelText(/4 digit PIN/)).toHaveValue('');
  });

  it('shows the lock time and points to the account password when too many tries failed', async () => {
    const submit = vi.fn(async () => ({
      ok: false as const,
      reason: 'locked' as const,
      minutes: 5,
    }));
    setup(submit);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/4 digit PIN/), '0000');
    expect(await screen.findByText(/Try again in 5 minutes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use account password instead' })).toBeEnabled();
  });

  it('opens with the account password instead of the PIN', async () => {
    const { submit, onUnlocked } = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Use account password instead' }));
    await user.type(screen.getByLabelText(/Account password/), 'secret-pass');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(submit).toHaveBeenCalledWith({ password: 'secret-pass' });
    await vi.waitFor(() => expect(onUnlocked).toHaveBeenCalled());
  });

  it('shows a wrong account password and a network problem in words', async () => {
    const submit = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, reason: 'password_incorrect' })
      .mockRejectedValueOnce(new Error('offline'));
    setup(submit);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Use account password instead' }));
    await user.type(screen.getByLabelText(/Account password/), 'x');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(/That password is not right/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(/We could not check that/)).toBeInTheDocument();
  });

  it('closes with Cancel', async () => {
    const { onClose } = setup();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
