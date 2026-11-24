// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { UserRecord } from '@/lib/data/admin/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const { UsersTableClient } = await import('./UsersTableClient');
const { ToastProvider } = await import('./Toast');

const user = (id: string, over: Partial<UserRecord> = {}): UserRecord => ({
  id,
  email: `${id}@example.test`,
  status: 'active',
  createdAt: '2026-10-01T10:00:00.000Z',
  lastActiveAt: null,
  profiles: [{ id: 'p', name: 'A', kids: false }],
  sessions: 1,
  suspendedReason: null,
  ...over,
});
const outcome = (over = {}) => ({ bulkId: 'b', succeeded: [], failed: [], skipped: [], ...over });

function setup(canBulk = true, users = [user('a'), user('b'), user('me')]) {
  const bulk = vi.fn(async (ids: string[], _a: unknown, _b: string) => outcome({ succeeded: ids }));
  const undo = vi.fn(async () => ({ succeeded: [], failed: [] }));
  render(
    <ToastProvider>
      <UsersTableClient users={users} canBulk={canBulk} selfId="me" bulk={bulk} undo={undo} />
    </ToastProvider>,
  );
  return { bulk, undo };
}
const tick = (id: string) =>
  userEvent.click(screen.getAllByRole('checkbox', { name: `Select ${id}@example.test` })[0]!);

describe('UsersTableClient', () => {
  it('has no checkboxes for roles below admin', () => {
    setup(false);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('the own account row cannot be selected and says You', () => {
    setup();
    expect(screen.queryByRole('checkbox', { name: 'Select me@example.test' })).toBeNull();
    expect(screen.getAllByText('You').length).toBeGreaterThan(0);
  });

  it('Suspend asks for one reason and sends it with the selection', async () => {
    const { bulk } = setup();
    await tick('a');
    await tick('b');
    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    const dialog = await screen.findByRole('dialog');
    const go = within(dialog).getByRole('button', { name: 'Suspend 2' });
    expect(go).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Abuse reports');
    await userEvent.click(go);
    await waitFor(() =>
      expect(bulk).toHaveBeenCalledWith(
        ['a', 'b'],
        { type: 'suspend', reason: 'Abuse reports' },
        expect.any(String),
      ),
    );
  });

  it('Reinstate runs straight away and the report lists skipped accounts with reasons', async () => {
    const bulk = vi.fn(async () =>
      outcome({ succeeded: ['a'], skipped: [{ id: 'b', reason: 'Already active.' }] }),
    );
    const undo = vi.fn();
    render(
      <ToastProvider>
        <UsersTableClient users={[user('a'), user('b')]} canBulk selfId="me" bulk={bulk} undo={undo} />
      </ToastProvider>,
    );
    await tick('a');
    await tick('b');
    await userEvent.click(screen.getByRole('button', { name: 'Reinstate' }));
    expect(await screen.findByText('Already active.')).toBeInTheDocument();
  });

  it('Profiles is numeric in the header and the cells', () => {
    setup();
    expect(screen.getByRole('columnheader', { name: 'Profiles' })).toHaveClass('adm-num');
    expect(document.querySelector('td.adm-num')).not.toBeNull();
  });
});
