'use client';

import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { TextField } from './fields';

/**
 * Asks the person to confirm their password (and, where the action needs it, their authenticator code)
 * before a sensitive staff action (SECURITY.md section 4, D-069).
 */
export function ReauthDialog({
  open,
  withCode,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  withCode?: boolean;
  busy?: boolean;
  error?: string;
  onSubmit: (password: string, code?: string) => void;
  onCancel: () => void;
}) {
  const formId = useId();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Confirm it is you"
      description={
        withCode
          ? 'Enter your password and the 6 digit code from your authenticator app.'
          : 'Enter your password to continue. You will not be asked again for 10 minutes.'
      }
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} loading={busy}>
            Confirm
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="adm-stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(password, withCode ? code.replace(/\s/g, '') : undefined);
        }}
      >
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          autoFocus
          error={error}
          onChange={(event) => setPassword(event.target.value)}
        />
        {withCode ? (
          <TextField
            label="Authenticator code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        ) : null}
      </form>
    </Dialog>
  );
}

interface Waiting {
  work: () => Promise<CommandResult>;
  resolve: (result: CommandResult) => void;
}

/**
 * Wraps a command: when the server says a recent password confirmation is needed, shows the dialog,
 * confirms, and repeats the command once. Cancelling resolves with a quiet failure.
 */
export function useReauth(
  reauthenticate: (password: string, code?: string) => Promise<CommandResult>,
  options: { withCode?: boolean } = {},
): { guard: (work: () => Promise<CommandResult>) => Promise<CommandResult>; dialog: ReactNode } {
  const waiting = useRef<Waiting | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function guard(work: () => Promise<CommandResult>): Promise<CommandResult> {
    const first = await work();
    if (first.ok || !first.reauth) return first;
    return new Promise<CommandResult>((resolve) => {
      waiting.current = { work, resolve };
      setError(undefined);
      setOpen(true);
    });
  }

  async function submit(password: string, code?: string) {
    const pending = waiting.current;
    if (!pending) return;
    setBusy(true);
    try {
      const confirmed = await reauthenticate(password, code);
      if (!confirmed.ok) {
        setError(confirmed.error);
        return;
      }
      waiting.current = null;
      setOpen(false);
      pending.resolve(await pending.work());
    } catch {
      setError('That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    waiting.current?.resolve({ ok: false, error: 'Nothing was changed.' });
    waiting.current = null;
    setOpen(false);
  }

  const dialog = (
    <ReauthDialog
      open={open}
      withCode={options.withCode}
      busy={busy}
      error={error}
      onSubmit={submit}
      onCancel={cancel}
    />
  );
  return { guard, dialog };
}
