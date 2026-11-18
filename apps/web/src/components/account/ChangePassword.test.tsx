// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChangePasswordForm } from './ChangePassword';

const scorer = async (value: string) => (value.length >= 14 ? 3 : value.length >= 10 ? 2 : 0);
const GOOD = 'tidy-river-lamp-91';

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  cur: string,
  next: string,
  again: string,
) {
  if (cur) await user.type(screen.getByLabelText('Current password'), cur);
  if (next) await user.type(screen.getByLabelText('New password'), next);
  if (again) await user.type(screen.getByLabelText('Confirm new password'), again);
}

describe('ChangePasswordForm state 1: default, being filled', () => {
  it('shows the card heading with the last changed date and the fine print', () => {
    render(<ChangePasswordForm lastChanged="12 Aug 2026" scorer={scorer} />);
    expect(screen.getByRole('heading', { name: 'Password' })).toBeInTheDocument();
    expect(screen.getByText('Last changed 12 Aug 2026')).toBeInTheDocument();
    expect(
      screen.getByText('Changing your password signs you out on your other devices.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update password' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('shows the strength word and the three rules with met or not yet', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm lastChanged="x" scorer={scorer} />);
    await user.type(screen.getByLabelText('New password'), 'abc123');
    expect(await screen.findByText('Weak')).toBeInTheDocument();
    expect(screen.getByText('At least 10 characters (not yet)')).toBeInTheDocument();
    expect(screen.getByText('A letter and a number (met)')).toBeInTheDocument();
    expect(screen.getByText('Not a common password (met)')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('New password'));
    await user.type(screen.getByLabelText('New password'), 'tidy-river-1');
    expect(await screen.findByText('Okay')).toBeInTheDocument();
    expect(screen.getByText('At least 10 characters (met)')).toBeInTheDocument();
  });

  it('shows a tick in the confirm field once the two match', async () => {
    const user = userEvent.setup();
    const { container } = render(<ChangePasswordForm lastChanged="x" scorer={scorer} />);
    await fill(user, '', GOOD, GOOD);
    expect(container.querySelector('.acct-field__ok svg')).not.toBeNull();
  });

  it('clears the fields on Cancel', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm lastChanged="x" scorer={scorer} />);
    await fill(user, 'old-one-1234', GOOD, GOOD);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(screen.getByLabelText('New password')).toHaveValue('');
  });
});

describe('ChangePasswordForm state 2: validation errors', () => {
  it('names the wrong current password with the mockup copy', async () => {
    const change = vi.fn().mockResolvedValue({ ok: false, reason: 'wrong_current' });
    const user = userEvent.setup();
    render(<ChangePasswordForm lastChanged="x" change={change} scorer={scorer} />);
    await fill(user, 'oldpassword1', GOOD, GOOD);
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('Current password is not right.')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('says the passwords do not match and does not send', async () => {
    const change = vi.fn();
    const user = userEvent.setup();
    render(<ChangePasswordForm lastChanged="x" change={change} scorer={scorer} />);
    await fill(user, 'oldpassword1', GOOD, 'other-phrase-12');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('The passwords do not match.')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toHaveAttribute('aria-invalid', 'true');
    expect(change).not.toHaveBeenCalled();
  });

  it('shows every problem at once, as in the mockup', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm lastChanged="x" scorer={scorer} />);
    await fill(user, '', 'abc123', 'zzzzzz');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('Enter your current password.')).toBeInTheDocument();
    expect(screen.getByText('The passwords do not match.')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('asks for the current password first and puts focus there', async () => {
    const change = vi.fn();
    const user = userEvent.setup();
    render(<ChangePasswordForm lastChanged="x" change={change} scorer={scorer} />);
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(screen.getByLabelText('Current password')).toHaveFocus();
    expect(change).not.toHaveBeenCalled();
  });

  it('refuses a new password that breaks a rule', async () => {
    const change = vi.fn();
    const user = userEvent.setup();
    render(<ChangePasswordForm lastChanged="x" change={change} scorer={scorer} />);
    await fill(user, 'oldpassword1', 'short1', 'short1');
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    await vi.waitFor(() =>
      expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(screen.getByText('At least 10 characters (not yet)')).toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });

  it('shows the network message when the server is not reached', async () => {
    const change = vi.fn().mockRejectedValue(new Error('x'));
    const user = userEvent.setup();
    render(<ChangePasswordForm lastChanged="x" change={change} scorer={scorer} />);
    await fill(user, 'oldpassword1', GOOD, GOOD);
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    expect(
      await within(screen.getByRole('alert')).findByText(/could not reach the server/i),
    ).toBeInTheDocument();
  });
});

describe('ChangePasswordForm state 3: success', () => {
  it('reports how many devices were signed out and empties the form', async () => {
    const change = vi.fn().mockResolvedValue({ ok: true, signedOutDevices: 2 });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(
      <ChangePasswordForm lastChanged="x" change={change} onChanged={onChanged} scorer={scorer} />,
    );
    await fill(user, 'oldpassword1', GOOD, GOOD);
    await user.click(screen.getByRole('button', { name: 'Update password' }));
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledWith(2));
    expect(change).toHaveBeenCalledWith({ current: 'oldpassword1', next: GOOD });
    expect(screen.getByLabelText('New password')).toHaveValue('');
  });
});
