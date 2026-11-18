// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeletionNotice } from './DeletionNotice';

describe('DeletionNotice (S30 state 6)', () => {
  it('says when the account will be removed and offers Cancel deletion and Sign out', () => {
    render(
      <DeletionNotice purgeDate="1 Dec 2026" days={14} onCancel={vi.fn()} onSignOut={vi.fn()} />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your account is set to close' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 Dec 2026, in 14 days/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel deletion' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('says "tomorrow" style copy without a negative number on the last day', () => {
    render(
      <DeletionNotice purgeDate="1 Dec 2026" days={1} onCancel={vi.fn()} onSignOut={vi.fn()} />,
    );
    expect(screen.getByText(/in 1 day\b/)).toBeInTheDocument();
  });

  it('cancels and shows the result', async () => {
    const onCancel = vi.fn(async () => ({ ok: true as const }));
    const user = userEvent.setup();
    render(
      <DeletionNotice purgeDate="1 Dec 2026" days={14} onCancel={onCancel} onSignOut={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel deletion' }));
    expect(onCancel).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent(/Your account is back/);
  });

  it('shows an alert when cancelling fails and keeps the button usable', async () => {
    const onCancel = vi.fn(async () => ({ ok: false as const }));
    const user = userEvent.setup();
    render(
      <DeletionNotice purgeDate="1 Dec 2026" days={14} onCancel={onCancel} onSignOut={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel deletion' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not cancel/i);
    expect(screen.getByRole('button', { name: 'Cancel deletion' })).toBeEnabled();
  });
});
