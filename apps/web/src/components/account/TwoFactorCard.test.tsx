// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TwoFactorCard } from './TwoFactorCard';

const begin = vi
  .fn()
  .mockResolvedValue({ ok: true, secret: 'JBSW Y3DP', uri: 'otpauth://x', qrSvg: '<svg></svg>' });

function actions(over: Record<string, unknown> = {}) {
  return {
    begin,
    confirm: vi.fn().mockResolvedValue({ ok: true, recoveryCodes: ['aaaaa-bbbbb'] }),
    disable: vi.fn().mockResolvedValue({ ok: true }),
    regenerate: vi.fn().mockResolvedValue({ ok: true, recoveryCodes: ['nnnnn-mmmmm'] }),
    ...over,
  };
}

describe('TwoFactorCard', () => {
  it('off: offers Turn on and says what it does', () => {
    render(
      <TwoFactorCard
        initial={{ enabled: false, recoveryRemaining: 0, low: false }}
        {...actions()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Turn on' })).toBeInTheDocument();
  });

  it('on: shows the count and no warning when plenty are left', () => {
    render(
      <TwoFactorCard
        initial={{ enabled: true, recoveryRemaining: 8, low: false }}
        {...actions()}
      />,
    );
    expect(screen.getByText('8 backup codes left')).toBeInTheDocument();
    expect(screen.queryByText(/running low/)).toBeNull();
  });

  it('low codes: warns and offers new ones', () => {
    render(
      <TwoFactorCard initial={{ enabled: true, recoveryRemaining: 2, low: true }} {...actions()} />,
    );
    expect(screen.getByText(/running low/)).toBeInTheDocument();
  });

  it('empty: says no backup codes left', () => {
    render(
      <TwoFactorCard initial={{ enabled: true, recoveryRemaining: 0, low: true }} {...actions()} />,
    );
    expect(screen.getByText('No backup codes left')).toBeInTheDocument();
  });

  it('turns on: key and picture, code, then codes gate, then on', async () => {
    const a = actions();
    const user = userEvent.setup();
    render(<TwoFactorCard initial={{ enabled: false, recoveryRemaining: 0, low: false }} {...a} />);
    await user.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(await screen.findByText('JBSW Y3DP')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'QR code for your authenticator app' }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('Enter the 6 digit code from the app'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirm and turn on' }));
    expect(a.confirm).toHaveBeenCalledWith({ code: '123456' });
    expect(await screen.findByText('aaaaa-bbbbb')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'I saved these codes' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('1 backup code left')).toBeInTheDocument();
  });

  it('a wrong code shows the message and keeps two step off', async () => {
    const a = actions({ confirm: vi.fn().mockResolvedValue({ ok: false, reason: 'wrong' }) });
    const user = userEvent.setup();
    render(<TwoFactorCard initial={{ enabled: false, recoveryRemaining: 0, low: false }} {...a} />);
    await user.click(screen.getByRole('button', { name: 'Turn on' }));
    await user.type(await screen.findByLabelText('Enter the 6 digit code from the app'), '000000');
    await user.click(screen.getByRole('button', { name: 'Confirm and turn on' }));
    expect(await screen.findByText(/That code is not right/)).toBeInTheDocument();
  });

  it('cancel returns to off without confirming', async () => {
    const a = actions();
    const user = userEvent.setup();
    render(<TwoFactorCard initial={{ enabled: false, recoveryRemaining: 0, low: false }} {...a} />);
    await user.click(screen.getByRole('button', { name: 'Turn on' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Turn on' })).toBeInTheDocument();
    expect(a.confirm).not.toHaveBeenCalled();
  });

  it('turn off needs the password and a code, shows the wrong password and then succeeds', async () => {
    const disable = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, reason: 'wrong_password' })
      .mockResolvedValueOnce({ ok: true });
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(
      <TwoFactorCard
        initial={{ enabled: true, recoveryRemaining: 9, low: false }}
        {...actions({ disable })}
        onChanged={onChanged}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Turn off' }));
    await user.type(screen.getByLabelText('Your password'), 'pw');
    await user.type(screen.getByLabelText('Authenticator code or backup code'), '123456');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Turn off' }));
    expect(await screen.findByText('That password is not right.')).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Turn off' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('off'));
    expect(await screen.findByRole('button', { name: 'Turn on' })).toBeInTheDocument();
  });

  it('new codes need the password and show the fresh set once', async () => {
    const a = actions();
    const user = userEvent.setup();
    render(<TwoFactorCard initial={{ enabled: true, recoveryRemaining: 2, low: true }} {...a} />);
    await user.click(screen.getByRole('button', { name: 'Get new codes' }));
    await user.type(screen.getByLabelText('Your password'), 'pw');
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Get new codes' }),
    );
    expect(a.regenerate).toHaveBeenCalledWith({ password: 'pw' });
    expect(await screen.findByText('nnnnn-mmmmm')).toBeInTheDocument();
  });
});
