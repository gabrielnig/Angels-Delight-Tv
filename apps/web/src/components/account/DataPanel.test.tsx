// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestExportAction, deleteAccountAction } = vi.hoisted(() => ({
  requestExportAction: vi.fn(),
  deleteAccountAction: vi.fn(),
}));
vi.mock('../../app/actions', () => ({ requestExportAction, deleteAccountAction }));

import { DataPanel } from './DataPanel';

beforeEach(() => {
  requestExportAction.mockReset();
  deleteAccountAction.mockReset();
});

describe('DataPanel export (S30 states 1 to 4)', () => {
  it('asks for the password, then shows the building state with the email promise', async () => {
    requestExportAction.mockResolvedValue({
      ok: true,
      already: false,
      state: { status: 'pending', requestedAt: '2026-11-17T09:14:00Z' },
    });
    const user = userEvent.setup();
    render(<DataPanel initial={{ status: 'none' }} />);
    await user.type(screen.getByLabelText('Password to confirm the export'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Request export' }));
    expect(requestExportAction).toHaveBeenCalledWith({ password: 'pw' });
    expect(await screen.findByText(/We will email you when it is ready/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request export' })).toBeDisabled();
  });

  it('says the earlier export is still valid when asked twice in a day', async () => {
    requestExportAction.mockResolvedValue({
      ok: true,
      already: true,
      state: { status: 'pending' },
    });
    const user = userEvent.setup();
    render(<DataPanel initial={{ status: 'none' }} />);
    await user.type(screen.getByLabelText('Password to confirm the export'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Request export' }));
    expect(
      await screen.findByText('An earlier export is still valid, so a new one is not needed.'),
    ).toBeInTheDocument();
  });

  it('shows a wrong password on the field', async () => {
    requestExportAction.mockResolvedValue({ ok: false, reason: 'wrong_password' });
    const user = userEvent.setup();
    render(<DataPanel initial={{ status: 'none' }} />);
    await user.type(screen.getByLabelText('Password to confirm the export'), 'bad');
    await user.click(screen.getByRole('button', { name: 'Request export' }));
    expect(await screen.findByText('That password is not right.')).toBeInTheDocument();
  });

  it('shows the ready file with its size and expiry, and the failed state with Try again', () => {
    const { unmount } = render(
      <DataPanel
        initial={{
          status: 'ready',
          fileName: 'angels-delight-data.json',
          sizeLabel: '42 KB',
          expiresLabel: 'tomorrow, 9:14 am',
          downloadHref: '/api/account/export?token=t',
        }}
      />,
    );
    expect(screen.getByRole('link', { name: /Download angels-delight-data.json/ })).toHaveAttribute(
      'href',
      '/api/account/export?token=t',
    );
    expect(screen.getByText(/link works until tomorrow, 9:14 am/)).toBeInTheDocument();
    unmount();
    render(<DataPanel initial={{ status: 'failed' }} />);
    expect(screen.getByText(/We could not build your export/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });
});
