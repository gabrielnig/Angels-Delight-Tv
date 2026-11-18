// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { InviteCodeDto, InviteCodeResult } from '@/lib/data/admin/site-types';
import { ToastProvider } from '../Toast';
import { InviteCodesTab, type InviteCodeActions } from './InviteCodesTab';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

const row = (overrides: Partial<InviteCodeDto> = {}): InviteCodeDto => ({
  id: 'i1',
  label: 'Pilot group',
  hint: 'RB',
  uses: 2,
  maxUses: 10,
  expiresAt: null,
  createdAt: '2026-11-01T09:00:00Z',
  status: 'active',
  ...overrides,
});

function setup(
  initial: InviteCodeDto[],
  overrides: {
    signUpOpen?: boolean;
    create?: InviteCodeActions['create'];
    revoke?: InviteCodeActions['revoke'];
  } = {},
) {
  const create = overrides.create ?? vi.fn<InviteCodeActions['create']>();
  const revoke = overrides.revoke ?? vi.fn<InviteCodeActions['revoke']>();
  render(
    <ToastProvider>
      <InviteCodesTab
        initial={initial}
        signUpOpen={overrides.signUpOpen ?? false}
        actions={{ create, revoke }}
      />
    </ToastProvider>,
  );
  return { create, revoke };
}

describe('InviteCodesTab', () => {
  it('shows the empty state', () => {
    setup([]);
    expect(screen.getByText('No invite codes yet')).toBeInTheDocument();
  });

  it('lists codes by their last characters with uses, expiry and status', () => {
    setup([
      row(),
      row({ id: 'i2', label: 'Old', hint: 'ZK', status: 'revoked', expiresAt: '2026-12-01T00:00:00Z' }),
    ]);
    const first = screen.getByText('Pilot group').closest('tr')!;
    expect(within(first).getByText('Ends in RB')).toBeInTheDocument();
    expect(within(first).getByText('2 of 10')).toBeInTheDocument();
    expect(within(first).getByText('Active')).toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'Revoke code Pilot group' })).toBeEnabled();
    const second = screen.getByText('Old').closest('tr')!;
    expect(within(second).getByText('Revoked')).toBeInTheDocument();
    expect(within(second).queryByRole('button', { name: /Revoke/ })).not.toBeInTheDocument();
  });

  it('says codes are not needed while sign up is open', () => {
    setup([], { signUpOpen: true });
    expect(screen.getByText(/Sign up is open, so visitors do not need a code/)).toBeInTheDocument();
  });

  it('creates a code, shows it once with a copy button and adds the row', async () => {
    const user = userEvent.setup();
    const result: InviteCodeResult = { ok: true, code: 'K7QM-3WTD-RB', invites: [row({ label: 'Church group', hint: 'RB', uses: 0, maxUses: 25 })] };
    const create = vi.fn<InviteCodeActions['create']>().mockResolvedValue(result);
    setup([], { create });
    await user.type(screen.getByLabelText('Label'), 'Church group');
    await user.clear(screen.getByLabelText('Uses allowed'));
    await user.type(screen.getByLabelText('Uses allowed'), '25');
    await user.click(screen.getByRole('button', { name: 'Create code' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ label: 'Church group', maxUses: 25, expiresAt: null }));
    expect(await screen.findByText('K7QM-3WTD-RB')).toBeInTheDocument();
    expect(screen.getByText(/It will not be shown again/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
    expect(screen.getByText('Church group')).toBeInTheDocument();
  });

  it('sends the expiry as the end of the chosen day in Lagos time', async () => {
    const user = userEvent.setup();
    const create = vi.fn<InviteCodeActions['create']>().mockResolvedValue({ ok: true, code: 'AAAA-BBBB-CC', invites: [] });
    setup([], { create });
    await user.type(screen.getByLabelText('Expires on (optional)'), '2026-12-31');
    await user.click(screen.getByRole('button', { name: 'Create code' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]![0].expiresAt).toBe('2026-12-31T22:59:59.000Z');
  });

  it('keeps the form and shows the reason when creation fails', async () => {
    const user = userEvent.setup();
    const create = vi.fn<InviteCodeActions['create']>().mockResolvedValue({ ok: false, error: 'Use a number from 1 to 1000' });
    setup([], { create });
    await user.type(screen.getByLabelText('Label'), 'Keep me');
    await user.click(screen.getByRole('button', { name: 'Create code' }));
    expect(await screen.findByText('Use a number from 1 to 1000')).toBeInTheDocument();
    expect(screen.getByLabelText('Label')).toHaveValue('Keep me');
  });

  it('asks before revoking and then updates the row', async () => {
    const user = userEvent.setup();
    const revoke = vi.fn<InviteCodeActions['revoke']>().mockResolvedValue({ ok: true, invites: [row({ status: 'revoked' })] });
    setup([row()], { revoke });
    await user.click(screen.getByRole('button', { name: 'Revoke code Pilot group' }));
    expect(revoke).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Revoke code' }));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('i1'));
    expect(await screen.findByText('Revoked')).toBeInTheDocument();
  });
});
