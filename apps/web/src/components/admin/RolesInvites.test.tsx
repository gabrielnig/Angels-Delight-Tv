// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStore } from '@/lib/data/admin/store';
import { RolesInvites } from './RolesInvites';
import { ToastProvider } from './Toast';
import { UserDetail } from './UserDetail';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);

const s = structuredClone(getStore());
const ok = () => vi.fn().mockResolvedValue({ ok: true });
const now = Date.now();

function roles(canManage = true) {
  const actions = {
    invite: ok(),
    resend: ok(),
    revoke: ok(),
    changeRole: ok(),
    reauthenticate: ok(),
    resetTwoFactor: ok(),
  };
  render(
    <ToastProvider>
      <RolesInvites
        staff={s.staff}
        invites={s.invites}
        now={now}
        canManage={canManage}
        selfId="acc_arkdev"
        actions={actions}
      />
    </ToastProvider>,
  );
  return actions;
}

describe('RolesInvites', () => {
  it('sends an invite', async () => {
    const a = roles();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));
    await waitFor(() => expect(a.invite).toHaveBeenCalledWith('new@example.test', 'editor'));
  });
  it('asks before changing a role', async () => {
    const a = roles();
    fireEvent.change(screen.getByLabelText('Role for Ngozi'), { target: { value: 'admin' } });
    expect(a.changeRole).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Change role' }));
    await waitFor(() => expect(a.changeRole).toHaveBeenCalledWith('stf_2', 'admin'));
  });
  it('asks for the password when the server wants a recent confirmation, then retries', async () => {
    const a = roles();
    a.invite
      .mockResolvedValueOnce({
        ok: false,
        error: 'Confirm your password to continue.',
        reauth: true,
      })
      .mockResolvedValueOnce({ ok: true });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send invite' }));
    fireEvent.change(await screen.findByLabelText('Password'), {
      target: { value: 'secret-pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(a.invite).toHaveBeenCalledTimes(2));
    expect(a.reauthenticate).toHaveBeenCalledWith('secret-pass', undefined);
  });
  it('resets another person two step sign in with the admin code', async () => {
    const a = roles();
    fireEvent.click(screen.getByRole('button', { name: 'Reset two step sign in for Ngozi' }));
    fireEvent.change(screen.getByLabelText('Your authenticator code'), {
      target: { value: '123 456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(a.resetTwoFactor).toHaveBeenCalledWith('stf_2', '123456'));
  });
  it('does not offer a reset for yourself', () => {
    roles();
    expect(screen.queryByRole('button', { name: /Reset two step sign in for Arkdev/ })).toBeNull();
  });
  it('offers Editor, Admin and Super admin and asks before making a Super admin', async () => {
    const a = roles();
    const select = screen.getByLabelText('Role for Ngozi') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Editor',
      'Admin',
      'Super admin',
    ]);
    fireEvent.change(select, { target: { value: 'super_admin' } });
    expect(screen.getByText(/Super admins can invite people, change roles/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Change role' }));
    await waitFor(() => expect(a.changeRole).toHaveBeenCalledWith('stf_2', 'super_admin'));
  });
  it('locks your own role and says why', () => {
    roles();
    const own = screen.getByLabelText('Role for Arkdev') as HTMLSelectElement;
    expect(own.disabled).toBe(true);
    expect(screen.getByText('The only Super admin')).toBeTruthy();
  });
  it('shows the last Super admin guard message when the server refuses', async () => {
    const a = roles();
    a.changeRole.mockResolvedValueOnce({
      ok: false,
      error: 'There must be at least one Super admin',
    });
    fireEvent.change(screen.getByLabelText('Role for Ngozi'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change role' }));
    expect(
      (await screen.findAllByText('There must be at least one Super admin')).length,
    ).toBeGreaterThan(0);
  });
  it('lists Super admin in the invite roles', () => {
    roles();
    const invite = screen.getAllByLabelText('Role').at(-1) as HTMLSelectElement;
    expect([...invite.options].map((o) => o.value)).toContain('super_admin');
  });
  it('marks an expired invite in words', () => {
    roles();
    expect(screen.getByText(/^Expired /)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Send a new invite to old@example.test' }).textContent,
    ).toBe('Send a new invite');
  });
  it('shows a read only permission table covering every action', () => {
    roles();
    expect(screen.getByRole('table', { name: /Permissions by role/ })).toBeTruthy();
    expect(
      screen.getByRole('rowheader', { name: 'Read content actions in the audit log' }),
    ).toBeTruthy();
    for (const name of ['Editor', 'Admin', 'Super admin'])
      expect(screen.getByRole('columnheader', { name })).toBeTruthy();
  });
  it('marks Super admin only rows as No for admins and Yes for Super admins', () => {
    roles();
    const row = screen
      .getByRole('rowheader', { name: 'Retry or discard failed jobs' })
      .closest('tr')!;
    const cells = [...row.querySelectorAll('td')].map((c) => c.textContent?.trim());
    expect(cells).toEqual(['No', 'No', 'Yes']);
  });
  it('locks controls without rights', () => {
    roles(false);
    expect(
      (screen.getByRole('button', { name: 'Send invite' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe('UserDetail', () => {
  it('needs a reason before suspending', async () => {
    const actions = {
      suspend: vi.fn().mockResolvedValue({
        ok: false,
        error: 'Write a short reason. It is kept in the audit log.',
      }),
      reinstate: ok(),
      revokeSessions: ok(),
    };
    render(
      <ToastProvider>
        <UserDetail user={s.users[0]!} canAct actions={actions} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Suspend account' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Suspend account' }).at(-1)!);
    await waitFor(() =>
      expect(screen.getAllByText(/Write a short reason/).length).toBeGreaterThan(0),
    );
  });

  it('offers Delete account only to a Super admin and needs the typed word', async () => {
    const deleteAccount = vi.fn().mockResolvedValue({ ok: true });
    const actions = { suspend: ok(), reinstate: ok(), revokeSessions: ok(), deleteAccount };
    const { rerender } = render(
      <ToastProvider>
        <UserDetail user={s.users[0]!} canAct actions={actions} />
      </ToastProvider>,
    );
    expect(screen.queryByRole('button', { name: 'Delete account' })).toBeNull();
    rerender(
      <ToastProvider>
        <UserDetail user={s.users[0]!} canAct canDelete actions={actions} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    const confirm = screen.getAllByRole('button', { name: 'Delete account' }).at(-1)!;
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Type DELETE to confirm'), {
      target: { value: 'DELETE' },
    });
    fireEvent.click(confirm);
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith(s.users[0]!.id, 'DELETE'));
  });
});
