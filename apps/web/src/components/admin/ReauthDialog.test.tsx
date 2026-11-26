// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { useReauth } from './ReauthDialog';

afterEach(cleanup);

function Harness({
  work,
  reauthenticate,
  withCode,
  emailCode,
  onDone,
}: {
  work: () => Promise<CommandResult>;
  reauthenticate: (password: string, code?: string) => Promise<CommandResult>;
  withCode?: boolean;
  emailCode?: {
    send: () => Promise<CommandResult>;
    confirm: (code: string) => Promise<CommandResult>;
  };
  onDone: (r: CommandResult) => void;
}) {
  const { guard, dialog } = useReauth(reauthenticate, { withCode, emailCode });
  return (
    <>
      <button type="button" onClick={async () => onDone(await guard(work))}>
        Go
      </button>
      {dialog}
    </>
  );
}

const needsReauth: CommandResult = {
  ok: false,
  error: 'Confirm your password to continue.',
  reauth: true,
};

describe('useReauth', () => {
  it('passes a result straight through when no confirmation is needed', async () => {
    const onDone = vi.fn();
    render(<Harness work={async () => ({ ok: true })} reauthenticate={vi.fn()} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ ok: true }));
    expect(screen.queryByLabelText('Password')).toBeNull();
  });

  it('asks for the password, then repeats the action', async () => {
    const work = vi.fn().mockResolvedValueOnce(needsReauth).mockResolvedValueOnce({ ok: true });
    const reauthenticate = vi.fn().mockResolvedValue({ ok: true });
    const onDone = vi.fn();
    render(<Harness work={work} reauthenticate={reauthenticate} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    const field = await screen.findByLabelText('Password');
    fireEvent.change(field, { target: { value: 'river-lantern-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ ok: true }));
    expect(reauthenticate).toHaveBeenCalledWith('river-lantern-42', undefined);
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('shows a wrong password in the dialog and keeps it open', async () => {
    const reauthenticate = vi.fn().mockResolvedValue({ ok: false, error: 'Password is not right' });
    render(
      <Harness work={async () => needsReauth} reauthenticate={reauthenticate} onDone={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('Password is not right')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });

  it('also asks for the authenticator code when required', async () => {
    const work = vi.fn().mockResolvedValueOnce(needsReauth).mockResolvedValueOnce({ ok: true });
    const reauthenticate = vi.fn().mockResolvedValue({ ok: true });
    render(<Harness work={work} reauthenticate={reauthenticate} withCode onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.change(await screen.findByLabelText('Password'), { target: { value: 'pw' } });
    fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123 456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(reauthenticate).toHaveBeenCalledWith('pw', '123456'));
  });

  it('resolves with a quiet failure when cancelled', async () => {
    const onDone = vi.fn();
    render(<Harness work={async () => needsReauth} reauthenticate={vi.fn()} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await screen.findByLabelText('Password');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({ ok: false, error: 'Nothing was changed.' }),
    );
  });
});

describe('useReauth with an emailed code option (D-397)', () => {
  const emailCode = () => ({
    send: vi.fn().mockResolvedValue({ ok: true }),
    confirm: vi.fn().mockResolvedValue({ ok: true }),
  });

  it('offers a code by email instead of the password, then repeats the action', async () => {
    const work = vi.fn().mockResolvedValueOnce(needsReauth).mockResolvedValueOnce({ ok: true });
    const email = emailCode();
    const onDone = vi.fn();
    render(<Harness work={work} reauthenticate={vi.fn()} emailCode={email} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Email me a code instead' }));
    await waitFor(() => expect(email.send).toHaveBeenCalledTimes(1));
    fireEvent.change(await screen.findByLabelText('Emailed code'), { target: { value: '123 456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ ok: true }));
    expect(email.confirm).toHaveBeenCalledWith('123456');
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('shows a wrong code inside the dialog and keeps it open', async () => {
    const email = emailCode();
    email.confirm.mockResolvedValue({ ok: false, error: 'That code is not right' });
    render(
      <Harness work={async () => needsReauth} reauthenticate={vi.fn()} emailCode={email} onDone={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Email me a code instead' }));
    fireEvent.change(await screen.findByLabelText('Emailed code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText('That code is not right')).toBeTruthy();
  });

  it('lets the person go back to the password', async () => {
    render(
      <Harness work={async () => needsReauth} reauthenticate={vi.fn()} emailCode={emailCode()} onDone={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Email me a code instead' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use my password instead' }));
    expect(await screen.findByLabelText('Password')).toBeTruthy();
  });

  it('has no email option unless the app provides one', async () => {
    render(<Harness work={async () => needsReauth} reauthenticate={vi.fn()} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await screen.findByLabelText('Password');
    expect(screen.queryByRole('button', { name: 'Email me a code instead' })).toBeNull();
  });

  it('has an eye button on the password field', async () => {
    render(<Harness work={async () => needsReauth} reauthenticate={vi.fn()} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await screen.findByLabelText('Password');
    expect(screen.getByRole('button', { name: 'Show password' })).toBeTruthy();
  });
});
