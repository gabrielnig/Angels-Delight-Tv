// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChangePasswordForm } from './ChangePassword';

describe('ChangePasswordForm', () => {
  it('shows an error on the current password field when it is wrong', async () => {
    const change = vi.fn().mockResolvedValue({ ok: false, reason: 'wrong_current' });
    const user = userEvent.setup();
    render(<ChangePasswordForm change={change} />);
    await user.type(screen.getByLabelText('Current password'), 'oldpassword1');
    await user.type(screen.getByLabelText('New password'), 'a-much-longer-new-phrase-91');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('That is not your current password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('confirms success and how many devices were signed out', async () => {
    const change = vi.fn().mockResolvedValue({ ok: true, signedOutDevices: 2 });
    const user = userEvent.setup();
    render(<ChangePasswordForm change={change} />);
    await user.type(screen.getByLabelText('Current password'), 'oldpassword1');
    await user.type(screen.getByLabelText('New password'), 'a-much-longer-new-phrase-91');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(
      await screen.findByText(/Password changed\. 2 other devices were signed out\./),
    ).toBeInTheDocument();
  });

  it('does not submit an empty form', async () => {
    const change = vi.fn();
    const user = userEvent.setup();
    render(<ChangePasswordForm change={change} />);
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Current password')).toHaveFocus();
  });
});
