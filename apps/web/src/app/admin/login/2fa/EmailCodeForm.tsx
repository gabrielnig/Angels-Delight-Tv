'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/admin/Button';
import { Checkbox, TextField } from '@/components/admin/fields';
import type { CodeState, ResendState } from '../actions';

interface Props {
  next: string;
  /** False when the first mail failed: the person is told and can ask again at once. */
  sent: boolean;
  /** Shows Remember this device. False when the site setting is 0 days. */
  canRemember: boolean;
  rememberDays?: number;
  verify: (state: CodeState, form: FormData) => Promise<CodeState>;
  resend: () => Promise<ResendState>;
}

const FIRST_WAIT = 60;

/** The emailed code step of staff sign in (D-397). One field, one primary action, an honest resend with its wait. */
export function EmailCodeForm({ next, sent, canRemember, rememberDays = 30, verify, resend }: Props) {
  const [state, action, pending] = useActionState<CodeState, FormData>(verify, {});
  const [wait, setWait] = useState(sent ? FIRST_WAIT : 0);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(
    sent ? null : 'We could not send the code. Send a new code.',
  );
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setInterval(() => setWait((left) => Math.max(0, left - 1)), 1000);
    return () => clearInterval(timer);
  }, [wait > 0]);

  async function sendAgain() {
    setSending(true);
    setNotice(null);
    setProblem(null);
    const result = await resend();
    setSending(false);
    if (result.sent) setNotice('A new code is on its way. Check your email.');
    else if (result.error) setProblem(result.error);
    setWait(result.wait ?? 0);
  }

  const waiting = wait > 0;
  return (
    <div className="adm-stack">
      <form action={action} className="adm-stack">
        <input type="hidden" name="next" value={next} />
        {state.error ? (
          <p role="alert" className="adm-field__error">
            {state.error}
          </p>
        ) : null}
        <TextField
          label="6 digit code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          pattern="[0-9]*"
          autoFocus
          required
        />
        {canRemember ? (
          <Checkbox
            label={`Remember this device for ${rememberDays} days`}
            name="remember"
            defaultChecked
          />
        ) : null}
        <Button type="submit" variant="primary" loading={pending}>
          Sign in
        </Button>
      </form>
      {problem ? (
        <p role="alert" className="adm-field__error">
          {problem}
        </p>
      ) : null}
      <p role="status" className="adm-muted" style={{ margin: 0 }}>
        {notice}
      </p>
      <Button
        variant="secondary"
        loading={sending}
        disabled={waiting}
        onClick={() => void sendAgain()}
      >
        Send a new code
      </Button>
      {waiting ? (
        <p className="adm-muted" style={{ margin: 0 }}>
          You can ask for another code in {wait} {wait === 1 ? 'second' : 'seconds'}.
        </p>
      ) : null}
    </div>
  );
}
