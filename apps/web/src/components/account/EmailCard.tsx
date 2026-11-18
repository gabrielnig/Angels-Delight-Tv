'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Modal, OtpInput } from '@ad/ui';
import { confirmEmailChangeAction, requestEmailChangeAction } from '../../app/actions';
import type { EmailChangeFailure } from '../../lib/data';
import { NETWORK_MESSAGE } from '../auth/shared';
import { AcctField } from './Field';
import { AcctIcon } from './icons';

type RequestResult = { ok: true; pendingEmail: string } | { ok: false; reason: EmailChangeFailure };
type ConfirmResult =
  { ok: true } | { ok: false; reason: 'invalid' | 'expired' | 'too_many' | 'network' };

const REQUEST_PROBLEM: Record<EmailChangeFailure, string> = {
  wrong_password: 'Password is not right.',
  invalid_email: 'Enter your full email, for example name@example.com.',
  same_email: 'That is already your email.',
  network: NETWORK_MESSAGE,
};
const CODE_PROBLEM: Record<'invalid' | 'expired' | 'too_many' | 'network', string> = {
  invalid: 'That code is not right. Check it and try again.',
  expired: 'That code has expired. Close this and ask for a new one.',
  too_many: 'Too many tries. Ask for a new code in a few minutes.',
  network: NETWORK_MESSAGE,
};

/** The Email card (S28) with the two step change: new address and password, then the 6 digit code. */
export function EmailCard({
  email,
  verified,
  request = requestEmailChangeAction,
  confirm = confirmEmailChangeAction,
  onChanged,
}: {
  email: string;
  verified: boolean;
  request?: (input: { newEmail: string; password: string }) => Promise<RequestResult>;
  confirm?: (input: { code: string }) => Promise<ConfirmResult>;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'address' | 'code'>('address');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(false);
    setStep('address');
    setNewEmail('');
    setPassword('');
    setCode('');
    setProblem(null);
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const result = await request({ newEmail, password });
      if (result.ok) {
        setNewEmail(result.pendingEmail);
        setStep('code');
      } else setProblem(REQUEST_PROBLEM[result.reason]);
    } catch {
      setProblem(NETWORK_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    setBusy(true);
    setProblem(null);
    try {
      const result = await confirm({ code: value });
      if (result.ok) {
        close();
        onChanged?.();
        router.refresh();
      } else {
        setProblem(CODE_PROBLEM[result.reason]);
        setCode('');
      }
    } catch {
      setProblem(NETWORK_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="acct-card" data-gap="3" aria-labelledby="acct-email">
      <h2 id="acct-email" className="acct-h2">
        Email
      </h2>
      <div className="acct-row" data-between data-wrap data-tight>
        <div className="acct-col">
          <span className="acct-linkrow__label">{email}</span>
          {verified ? (
            <span className="acct-row acct-email__badge" data-tight>
              <span className="acct-badge" data-tone="ok">
                <AcctIcon name="check" size={14} strokeWidth={3} />
                Verified
              </span>
            </span>
          ) : null}
        </div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Change email
        </Button>
      </div>
      <p className="acct-muted acct-small">
        We will send a 6 digit code to your new address before the change takes effect.
      </p>
      <Modal
        open={open}
        onClose={close}
        title={step === 'address' ? 'Change your email' : 'Enter the code'}
        className="acct-dialog"
        hideClose
        dismissOnScrim={false}
        error={problem ?? undefined}
      >
        {step === 'address' ? (
          <form className="acct-dialog__form" onSubmit={(e) => void send(e)} noValidate>
            <AcctField
              label="New email address"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <AcctField
              label="Your password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="acct-dialog__actions">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Send code
              </Button>
            </div>
          </form>
        ) : (
          <div className="acct-dialog__form">
            <p className="acct-muted">{`We sent a 6 digit code to ${newEmail}. It works for a short time.`}</p>
            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={(v) => void verify(v)}
              label="Enter the 6 digit code"
              loading={busy}
              autoFocus
            />
            <div className="acct-dialog__actions">
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
