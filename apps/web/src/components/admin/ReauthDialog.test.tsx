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
  onDone,
}: {
  work: () => Promise<CommandResult>;
  reauthenticate: (password: string, code?: string) => Promise<CommandResult>;
  withCode?: boolean;
  onDone: (r: CommandResult) => void;
}) {
  const { guard, dialog } = useReauth(reauthenticate, { withCode });
  return (
    <>
      <button type="button" onClick={async () => onDone(await guard(work))}>
        Go
      </button>
      {dialog}
    </>
  );
}

const needsReauth: CommandResult = { ok: false, error: 'Confirm your password to continue.', reauth: true };

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
      <Harness
        work={async () => needsReauth}
        reauthenticate={reauthenticate}
        onDone={vi.fn()}
      />,
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
    render(
      <Harness work={work} reauthenticate={reauthenticate} withCode onDone={vi.fn()} />,
    );
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
