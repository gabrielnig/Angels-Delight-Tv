// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureAccount } from '@/lib/data/admin/account-commands';
import { getStore } from '@/lib/data/admin/store';
import { MyAccountView } from './MyAccountView';
import { ToastProvider } from './Toast';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);

const account = ensureAccount(
  structuredClone(getStore()),
  { accountId: 'acc_x', role: 'admin', name: 'Chi' },
  'chi@example.test',
  Date.now(),
);
const ok = { ok: true } as const;
function view() {
  const actions = {
    updateName: vi.fn().mockResolvedValue(ok),
    changePassword: vi
      .fn()
      .mockResolvedValue({
        ok: false,
        field: 'current',
        error: 'That is not your current password.',
      }),
    revokeSession: vi.fn().mockResolvedValue(ok),
    regenerateCodes: vi.fn().mockResolvedValue({ ok: true, codes: ['aaaaa-bbbbb', 'ccccc-ddddd'] }),
  };
  render(
    <ToastProvider>
      <MyAccountView account={account} roleLabel="Super admin" now={Date.now()} actions={actions} />
    </ToastProvider>,
  );
  return actions;
}

describe('MyAccountView', () => {
  it('saves the name only when it changed', async () => {
    const a = view();
    const save = screen.getByRole('button', { name: 'Save name' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Chiamaka' } });
    fireEvent.click(save);
    await waitFor(() => expect(a.updateName).toHaveBeenCalledWith('Chiamaka'));
  });
  it('shows password rules and the server error on the right field', async () => {
    view();
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'purple-mango-river-42' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'purple-mango-river-42' },
    });
    expect(screen.getByRole('list', { name: 'Password rules' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() =>
      expect(screen.getAllByText('That is not your current password.').length).toBeGreaterThan(0),
    );
    expect(screen.getByLabelText('Current password').getAttribute('aria-invalid')).toBe('true');
  });
  it('only offers sign out for other devices', () => {
    view();
    expect(screen.queryByRole('button', { name: 'Sign out This browser' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out Phone, Chrome' })).toBeTruthy();
  });
  it('shows new recovery codes once after the password is confirmed', async () => {
    const a = view();
    fireEvent.click(screen.getByRole('button', { name: 'Make new recovery codes' }));
    fireEvent.change(screen.getAllByLabelText('Password').at(-1)!, {
      target: { value: 'fixture-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make new codes' }));
    await waitFor(() => expect(screen.getByRole('list', { name: 'Recovery codes' })).toBeTruthy());
    expect(a.regenerateCodes).toHaveBeenCalledWith('fixture-password');
  });
});
