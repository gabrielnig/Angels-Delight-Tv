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
    changePassword: vi.fn().mockResolvedValue({
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
    const a = view();
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'purple-mango-river-42' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'purple-mango-river-42' },
    });
    expect(screen.getByRole('list', { name: 'Password rules' })).toBeTruthy();
    const change = screen.getByRole('button', { name: 'Change password' }) as HTMLButtonElement;
    expect(change.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() =>
      expect(screen.getAllByText('That is not your current password.').length).toBeGreaterThan(0),
    );
    expect(screen.getByLabelText('Current password').getAttribute('aria-invalid')).toBe('true');
    expect(a.changePassword).toHaveBeenCalledWith(
      'x',
      'purple-mango-river-42',
      'purple-mango-river-42',
      '123456',
    );
  });
  it('only offers sign out for other devices', () => {
    view();
    expect(screen.queryByRole('button', { name: 'Sign out This browser' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out Phone, Chrome' })).toBeTruthy();
  });
  it('shows new recovery codes once after the authenticator code is confirmed', async () => {
    const a = view();
    fireEvent.click(screen.getByRole('button', { name: 'Make new recovery codes' }));
    fireEvent.change(screen.getAllByLabelText('Authenticator code').at(-1)!, {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make new codes' }));
    await waitFor(() => expect(screen.getByRole('list', { name: 'Recovery codes' })).toBeTruthy());
    expect(a.regenerateCodes).toHaveBeenCalledWith('123456');
  });
});

describe('MyAccountView with emailed codes (D-397)', () => {
  const emailAccount = {
    ...account,
    twoFactor: false,
    secondStep: 'email' as const,
    recoveryCodesLeft: 0,
    trustedDevices: [
      { id: 'td1', label: 'Chrome on Windows', place: 'Nigeria', lastUsedAt: null, expiresAt: new Date(Date.now() + 86400000).toISOString() },
    ],
  };
  function emailView(over = {}) {
    const actions = {
      updateName: vi.fn().mockResolvedValue(ok),
      changePassword: vi.fn().mockResolvedValue(ok),
      revokeSession: vi.fn().mockResolvedValue(ok),
      regenerateCodes: vi.fn(),
      sendConfirmCode: vi.fn().mockResolvedValue({ ok: true }),
      revokeTrustedDevice: vi.fn().mockResolvedValue(ok),
      switchToEmail: vi.fn().mockResolvedValue(ok),
    };
    render(
      <ToastProvider>
        <MyAccountView account={{ ...emailAccount, ...over }} roleLabel="Admin" now={Date.now()} actions={actions} />
      </ToastProvider>,
    );
    return actions;
  }

  it('asks for an emailed code on the password form and sends one on request', async () => {
    const a = emailView();
    expect(screen.queryByLabelText('Authenticator code')).toBeNull();
    expect(screen.getByLabelText('Emailed code')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
    await waitFor(() => expect(a.sendConfirmCode).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/code is on its way/)).toBeTruthy();
  });

  it('has no recovery codes to make without an authenticator, and says emailed codes are on', () => {
    emailView();
    expect(screen.queryByRole('button', { name: 'Make new recovery codes' })).toBeNull();
    expect(screen.getByText(/There are no recovery codes/)).toBeTruthy();
  });

  it('lists remembered devices and revokes one', async () => {
    const a = emailView();
    expect(screen.getByText('Chrome on Windows')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Forget Chrome on Windows' }));
    await waitFor(() => expect(a.revokeTrustedDevice).toHaveBeenCalledWith('td1'));
  });

  it('lets an authenticator user switch to emailed codes with their current code', async () => {
    const a = emailView({ secondStep: 'authenticator', twoFactor: true, emailSwitchAvailable: true, recoveryCodesLeft: 8 });
    fireEvent.click(screen.getByRole('button', { name: 'Use emailed codes instead' }));
    fireEvent.change(screen.getByLabelText('Authenticator code', { selector: 'dialog input, [role=dialog] input' }), {
      target: { value: '123 456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Switch to emailed codes' }));
    await waitFor(() => expect(a.switchToEmail).toHaveBeenCalledWith('123456'));
  });
});
