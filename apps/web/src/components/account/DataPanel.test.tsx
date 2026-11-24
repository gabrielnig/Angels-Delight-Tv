// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestExportAction, deleteAccountAction, push } = vi.hoisted(() => ({
  requestExportAction: vi.fn(),
  deleteAccountAction: vi.fn(),
  push: vi.fn(),
}));
vi.mock('../../app/actions', () => ({ requestExportAction, deleteAccountAction }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

import { DataPanel } from './DataPanel';

const EMAIL = 'chinedu.okafor@example.com';
const panel = (initial: Parameters<typeof DataPanel>[0]['initial']) =>
  render(<DataPanel initial={initial} email={EMAIL} />);

beforeEach(() => {
  requestExportAction.mockReset();
  deleteAccountAction.mockReset();
  push.mockReset();
});

describe('DataPanel state 1: default', () => {
  it('shows the two cards with the mockup copy', () => {
    panel({ status: 'none' });
    expect(screen.getByRole('heading', { name: 'Export my data' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Viewing activity' })).toBeInTheDocument();
    expect(screen.getByText(/does not delete your account/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open viewing activity' })).toHaveAttribute(
      'href',
      '/account/activity',
    );
    expect(
      screen.getByText(
        'Get a file with your account, profiles, My List and watch progress. We email you a link that works for 24 hours. It never includes your password.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request export' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Delete account' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'This closes your account and removes your profiles, My List and watch progress. You have 14 days to change your mind. After that it cannot be undone.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeInTheDocument();
  });

  it('asks for the password in a dialog before it requests the export', async () => {
    requestExportAction.mockResolvedValue({
      ok: true,
      already: false,
      state: { status: 'pending', requestedAt: 'today at 9:14 am' },
    });
    const user = userEvent.setup();
    panel({ status: 'none' });
    await user.click(screen.getByRole('button', { name: 'Request export' }));
    const dialog = screen.getByRole('dialog', { name: 'Confirm your password' });
    await user.type(within(dialog).getByLabelText('Your password'), 'pw');
    await user.click(within(dialog).getByRole('button', { name: 'Request export' }));
    expect(requestExportAction).toHaveBeenCalledWith({ password: 'pw' });
    expect(await screen.findByText(/Your export is being built/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a wrong password inside the dialog and keeps it open', async () => {
    requestExportAction.mockResolvedValue({ ok: false, reason: 'wrong_password' });
    const user = userEvent.setup();
    panel({ status: 'none' });
    await user.click(screen.getByRole('button', { name: 'Request export' }));
    await user.type(screen.getByLabelText('Your password'), 'bad');
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Request export' }),
    );
    expect(await screen.findByText('Password is not right.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('DataPanel state 2: export requested, in progress', () => {
  it('names the email and the time, and disables a second request', () => {
    panel({ status: 'pending', requestedAt: 'today at 9:14 am' });
    expect(
      screen.getByText(
        `Your export is being built. We will email ${EMAIL} when it is ready. You asked for it today at 9:14 am.`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request export' })).toBeDisabled();
    expect(
      screen.getByText('An earlier export is still valid, so a new one is not needed.'),
    ).toBeInTheDocument();
  });

  it('puts "on" before a dated label', () => {
    panel({ status: 'pending', requestedAt: '17 Nov, 9:14 am' });
    expect(screen.getByText(/You asked for it on 17 Nov, 9:14 am\./)).toBeInTheDocument();
  });
});

describe('DataPanel state 3: export ready', () => {
  it('shows the file, size, expiry and a Download link', () => {
    panel({
      status: 'ready',
      fileName: 'adtv-export-17-nov-2026.json',
      sizeLabel: '42 KB',
      expiresLabel: 'tomorrow, 9:14 am',
      downloadHref: '/api/account/export?token=t',
    });
    expect(screen.getByText('adtv-export-17-nov-2026.json')).toBeInTheDocument();
    expect(screen.getByText('42 KB, link works until tomorrow, 9:14 am')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'href',
      '/api/account/export?token=t',
    );
  });
});

describe('DataPanel state 4: export failed', () => {
  it('says nothing was lost and offers Try again', async () => {
    const user = userEvent.setup();
    panel({ status: 'failed' });
    expect(
      screen.getByText('We could not build your export. Nothing was lost. Try again.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('dialog', { name: 'Confirm your password' })).toBeInTheDocument();
  });
});

describe('DataPanel state 5: delete confirm dialog', () => {
  async function open() {
    const user = userEvent.setup();
    panel({ status: 'none' });
    await user.click(screen.getByRole('button', { name: 'Delete account' }));
    return { user, dialog: screen.getByRole('dialog', { name: 'Delete your account?' }) };
  }

  it('explains the grace period and keeps Delete my account off until DELETE is typed', async () => {
    const { user, dialog } = await open();
    expect(
      within(dialog).getByText(
        'We will sign you out everywhere and email you a link to cancel. You have 14 days. Then everything is removed.',
      ),
    ).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Delete my account' });
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await user.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'DEL');
    expect(confirm).toHaveAttribute('aria-disabled', 'true');
    await user.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'ETE');
    expect(confirm).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('Keep my account closes the dialog and deletes nothing', async () => {
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('button', { name: 'Keep my account' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(deleteAccountAction).not.toHaveBeenCalled();
  });

  it('sends the password and the typed word, then says when the account closes', async () => {
    deleteAccountAction.mockResolvedValue({ ok: true, days: 14 });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText('Your password'), 'pw');
    await user.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(within(dialog).getByRole('button', { name: 'Delete my account' }));
    expect(deleteAccountAction).toHaveBeenCalledWith({ password: 'pw', confirm: 'DELETE' });
    expect(await screen.findByText(/Your account will close in 14 days/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(push).toHaveBeenCalledWith('/');
  });

  it('says the password is wrong and keeps the dialog', async () => {
    deleteAccountAction.mockResolvedValue({ ok: false, reason: 'wrong_password' });
    const { user, dialog } = await open();
    await user.type(within(dialog).getByLabelText('Your password'), 'bad');
    await user.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'DELETE');
    await user.click(within(dialog).getByRole('button', { name: 'Delete my account' }));
    expect(await screen.findByText('Password is not right.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
