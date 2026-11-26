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
export interface EmailCodeOption {
  /** Mails a fresh confirmation code. */
  send: () => Promise<CommandResult>;
  /** Checks the emailed code and marks the session as recently confirmed. */
  confirm: (code: string) => Promise<CommandResult>;
}

export function ReauthDialog({
  open,
  withCode,
  busy,
  error,
  emailCode,
  onSubmit,
  onSubmitEmailCode,
  onCancel,
}: {
  open: boolean;
  withCode?: boolean;
  busy?: boolean;
  error?: string;
  /** Present when the person can confirm with a code sent by email instead of the password. */
  emailCode?: Pick<EmailCodeOption, 'send'>;
  onSubmit: (password: string, code?: string) => void;
  onSubmitEmailCode?: (code: string) => void;
  onCancel: () => void;
}) {
  const formId = useId();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [byEmail, setByEmail] = useState(false);
  const [sendProblem, setSendProblem] = useState<string>();
  async function useEmail() {
    setSendProblem(undefined);
    const result = await emailCode!.send();
    if (result.ok) setByEmail(true);
    else setSendProblem(result.error);
  }
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Confirm it is you"
      description={
        byEmail
          ? 'We emailed you a 6 digit code. Enter it to continue. You will not be asked again for 10 minutes.'
          : withCode
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
          if (byEmail) onSubmitEmailCode?.(code.replace(/\s/g, ''));
          else onSubmit(password, withCode ? code.replace(/\s/g, '') : undefined);
        }}
      >
        {byEmail ? (
          <TextField
            label="Emailed code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            autoFocus
            error={error}
            onChange={(event) => setCode(event.target.value)}
          />
        ) : (
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            autoFocus
            error={error}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
        {emailCode && !withCode ? (
          <div>
            <Button
              variant="ghost"
              onClick={() => {
                if (byEmail) {
                  setByEmail(false);
                  setCode('');
                } else void useEmail();
              }}
            >
              {byEmail ? 'Use my password instead' : 'Email me a code instead'}
            </Button>
            {sendProblem ? (
              <p role="alert" className="adm-field__error">
                {sendProblem}
              </p>
            ) : null}
          </div>
        ) : null}
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
  options: { withCode?: boolean; emailCode?: EmailCodeOption } = {},
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

  async function submit(password: string, code?: string, emailed?: string) {
    const pending = waiting.current;
    if (!pending) return;
    setBusy(true);
    try {
      const confirmed =
        emailed !== undefined
          ? await options.emailCode!.confirm(emailed)
          : await reauthenticate(password, code);
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
      emailCode={options.emailCode}
      onSubmit={submit}
      onSubmitEmailCode={(code) => void submit('', undefined, code)}
      onCancel={cancel}
    />
  );
  return { guard, dialog };
}
