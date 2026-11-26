// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SecurityInfo } from '@/lib/data/admin/types';
import { SecuritySection } from './SecuritySection';
import { ToastProvider } from './Toast';

afterEach(cleanup);
const ok = { ok: true } as const;

function mount(security: SecurityInfo, over: Record<string, unknown> = {}) {
  const actions = {
    sendTestCode: vi.fn().mockResolvedValue(ok),
    confirmTestCode: vi.fn().mockResolvedValue(ok),
    switchToEmail: vi.fn().mockResolvedValue(ok),
    beginAuthenticator: vi.fn().mockResolvedValue({ ok: true, secret: 'ABCDEFGH', qrSvg: '<svg></svg>' }),
    finishAuthenticator: vi.fn().mockResolvedValue({ ok: true, codes: ['aaaaa-bbbbb', 'ccccc-ddddd'] }),
    ...over,
  };
  const changed = vi.fn();
  render(
    <ToastProvider>
      <SecuritySection security={security} actions={actions} onChanged={changed} />
    </ToastProvider>,
  );
  return { actions, changed };
}
const onApp: SecurityInfo = { method: 'authenticator', canUseEmail: true, testedRecently: false };
const onEmail: SecurityInfo = { method: 'email', canUseEmail: true, testedRecently: false };
const dialog = () => screen.getByRole('dialog', { hidden: true });

describe('SecuritySection to emailed codes', () => {
  it('says which method is on and offers the switch', () => {
    mount(onApp);
    expect(screen.getByText('Authenticator app')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Switch to emailed codes' })).toBeTruthy();
  });

  it('explains why it is blocked and offers no switch form', () => {
    mount({ ...onApp, canUseEmail: false, blocker: 'Email is not set up on this site yet.' });
    fireEvent.click(screen.getByRole('button', { name: 'Switch to emailed codes' }));
    expect(within(dialog()).getByText('Email is not set up on this site yet.')).toBeTruthy();
    expect(within(dialog()).queryByLabelText('Password')).toBeNull();
  });

  it('keeps the switch locked until a test code worked, then sends password and authenticator code', async () => {
    const { actions, changed } = mount(onApp);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to emailed codes' }));
    const d = within(dialog());
    const go = d.getByRole('button', { name: /Switch to emailed codes/ });
    expect(go.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(d.getByRole('button', { name: 'Send test code' }));
    await waitFor(() => expect(actions.sendTestCode).toHaveBeenCalledTimes(1));
    fireEvent.change(await d.findByLabelText('Test code'), { target: { value: '123 456' } });
    fireEvent.click(d.getByRole('button', { name: 'Check code' }));
    await waitFor(() => expect(actions.confirmTestCode).toHaveBeenCalledWith('123 456'));
    await d.findByText('Your email works.');
    fireEvent.change(d.getByLabelText('Password'), { target: { value: 'pw-1234567890' } });
    fireEvent.change(d.getByLabelText('Authenticator code'), { target: { value: '654321' } });
    fireEvent.click(d.getByRole('button', { name: /Switch to emailed codes/ }));
    await waitFor(() =>
      expect(actions.switchToEmail).toHaveBeenCalledWith({ password: 'pw-1234567890', code: '654321' }),
    );
    await waitFor(() => expect(changed).toHaveBeenCalled());
  });

  it('can confirm with an emailed code instead, which needs no separate test', async () => {
    const { actions } = mount(onApp);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to emailed codes' }));
    const d = within(dialog());
    fireEvent.click(d.getByRole('button', { name: 'Confirm with an emailed code instead' }));
    fireEvent.click(d.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(actions.sendTestCode).toHaveBeenCalled());
    fireEvent.change(await d.findByLabelText('Emailed code'), { target: { value: '111222' } });
    fireEvent.click(d.getByRole('button', { name: /Switch to emailed codes/ }));
    await waitFor(() => expect(actions.switchToEmail).toHaveBeenCalledWith({ emailCode: '111222' }));
  });

  it('shows a server error on the field and changes nothing', async () => {
    const { changed } = mount(
      { ...onApp, testedRecently: true },
      { switchToEmail: vi.fn().mockResolvedValue({ ok: false, field: 'code', error: 'That code is not right' }) },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Switch to emailed codes' }));
    const d = within(dialog());
    fireEvent.change(d.getByLabelText('Password'), { target: { value: 'x' } });
    fireEvent.change(d.getByLabelText('Authenticator code'), { target: { value: '000000' } });
    fireEvent.click(d.getByRole('button', { name: /Switch to emailed codes/ }));
    expect(await d.findByText('That code is not right')).toBeTruthy();
    expect(changed).not.toHaveBeenCalled();
  });
});

describe('SecuritySection to an authenticator', () => {
  it('walks password, scan and code, then shows the recovery codes once', async () => {
    const { actions, changed } = mount(onEmail);
    expect(screen.getByText('Emailed code')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to an authenticator app' }));
    const d = within(dialog());
    fireEvent.change(d.getByLabelText('Password'), { target: { value: 'pw-1234567890' } });
    fireEvent.click(d.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(actions.beginAuthenticator).toHaveBeenCalledWith('pw-1234567890'));
    expect(await d.findByText('ABCDEFGH')).toBeTruthy();
    fireEvent.change(d.getByLabelText('6 digit code'), { target: { value: '123456' } });
    fireEvent.click(d.getByRole('button', { name: 'Turn on authenticator app' }));
    await waitFor(() => expect(actions.finishAuthenticator).toHaveBeenCalledWith('123456'));
    expect(await d.findByText('aaaaa-bbbbb')).toBeTruthy();
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(d.getByRole('button', { name: 'I have saved them' }));
    expect(changed).toHaveBeenCalled();
  });

  it('keeps the person on the password step when it is wrong', async () => {
    mount(onEmail, {
      beginAuthenticator: vi.fn().mockResolvedValue({ ok: false, field: 'password', error: 'Password is not right' }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Switch to an authenticator app' }));
    const d = within(dialog());
    fireEvent.change(d.getByLabelText('Password'), { target: { value: 'nope' } });
    fireEvent.click(d.getByRole('button', { name: 'Continue' }));
    expect(await d.findByText('Password is not right')).toBeTruthy();
  });
});
