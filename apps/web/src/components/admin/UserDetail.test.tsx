// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserDetail } from './UserDetail';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const user = {
  id: 'u1',
  email: 'a@example.org',
  status: 'active',
  sessions: 1,
  profiles: [],
  createdAt: '2026-01-01T00:00:00Z',
} as never;

describe('UserDetail reset two step verification', () => {
  it('asks for a reason and calls the action with it', async () => {
    const resetTwoFactor = vi.fn().mockResolvedValue({ ok: true });
    const actions = {
      suspend: vi.fn(),
      reinstate: vi.fn(),
      revokeSessions: vi.fn(),
      resetTwoFactor,
    };
    const u = userEvent.setup();
    render(<UserDetail user={user} canAct actions={actions} />);
    await u.click(screen.getByRole('button', { name: 'Reset two step verification' }));
    const dialog = screen.getByRole('dialog');
    await u.type(within(dialog).getByLabelText('Reason'), 'Verified by support email');
    await u.click(within(dialog).getByRole('button', { name: 'Reset two step verification' }));
    await waitFor(() =>
      expect(resetTwoFactor).toHaveBeenCalledWith('u1', 'Verified by support email'),
    );
  });

  it('hides the button when the person cannot act or the action is missing', () => {
    const actions = { suspend: vi.fn(), reinstate: vi.fn(), revokeSessions: vi.fn() };
    render(<UserDetail user={user} canAct actions={actions} />);
    expect(screen.queryByRole('button', { name: 'Reset two step verification' })).toBeNull();
  });
});
