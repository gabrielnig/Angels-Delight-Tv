// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConnectedSignInCard } from './ConnectedSignInCard';

const notConnected = { linked: false, hint: null, hasPassword: true };
const connected = { linked: true, hint: 'j***@gmail.com', hasPassword: true };

describe('ConnectedSignInCard', () => {
  it('not connected shows the Connect button as a link to the connect start', () => {
    render(<ConnectedSignInCard initial={notConnected} unlink={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Connected sign in' })).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect Google' })).toHaveAttribute(
      'href',
      '/api/auth/google/start?link=1',
    );
  });

  it('connected shows the masked address and a Remove button', () => {
    render(<ConnectedSignInCard initial={connected} unlink={vi.fn()} />);
    expect(screen.getByText('Connected as j***@gmail.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Google' })).toBeInTheDocument();
  });

  it('removing asks for the password, then updates the card and reports it', async () => {
    const unlink = vi.fn().mockResolvedValue({ ok: true });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<ConnectedSignInCard initial={connected} unlink={unlink} onChanged={onChanged} />);
    await user.click(screen.getByRole('button', { name: 'Remove Google' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Your password'), 'right password 1');
    await user.click(within(dialog).getByRole('button', { name: 'Remove Google' }));
    expect(unlink).toHaveBeenCalledWith('right password 1');
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('removed'));
    expect(screen.getByText('Not connected')).toBeInTheDocument();
  });

  it('a wrong password keeps Google connected and says so', async () => {
    const user = userEvent.setup();
    render(
      <ConnectedSignInCard
        initial={connected}
        unlink={vi.fn().mockResolvedValue({ ok: false, reason: 'wrong_password' })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Remove Google' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Your password'), 'nope');
    await user.click(within(dialog).getByRole('button', { name: 'Remove Google' }));
    expect(await within(dialog).findByText('That password is not right.')).toBeInTheDocument();
    expect(screen.getByText('Connected as j***@gmail.com')).toBeInTheDocument();
  });

  it('when Google is the only way in, Remove explains Set a password first and never asks for one', async () => {
    const unlink = vi.fn();
    const user = userEvent.setup();
    render(<ConnectedSignInCard initial={{ ...connected, hasPassword: false }} unlink={unlink} />);
    await user.click(screen.getByRole('button', { name: 'Remove Google' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Set a password first')).toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Your password')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Set a password' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(unlink).not.toHaveBeenCalled();
  });

  it('shows the lockout wait when too many passwords were tried', async () => {
    const user = userEvent.setup();
    render(
      <ConnectedSignInCard
        initial={connected}
        unlink={vi.fn().mockResolvedValue({ ok: false, reason: 'locked', minutes: 9 })}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Remove Google' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Your password'), 'x');
    await user.click(within(dialog).getByRole('button', { name: 'Remove Google' }));
    expect(
      await within(dialog).findByText('Too many tries. Try again in 9 minutes.'),
    ).toBeInTheDocument();
  });
});
