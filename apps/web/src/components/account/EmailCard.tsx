'use client';

import type { Translate } from '@ad/shared/messages';
import { useT } from '../../lib/i18n/provider';
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

const requestProblem = (msg: Translate): Record<EmailChangeFailure, string> => ({
  wrong_password: msg('account.passwordNotRight'),
  invalid_email: msg('account.enterYourFullEmail'),
  same_email: msg('account.thatIsAlreadyYour'),
  network: NETWORK_MESSAGE,
});
const codeProblem = (
  msg: Translate,
): Record<'invalid' | 'expired' | 'too_many' | 'network', string> => ({
  invalid: msg('account.thatCodeIsNot'),
  expired: msg('account.thatCodeHasExpired'),
  too_many: msg('account.tooManyTriesAsk'),
  network: NETWORK_MESSAGE,
});

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
  const msg = useT();
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
      } else setProblem(requestProblem(msg)[result.reason]);
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
        setProblem(codeProblem(msg)[result.reason]);
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
        {msg('account.email')}
      </h2>
      <div className="acct-row" data-between data-wrap data-tight>
        <div className="acct-col">
          <span className="acct-linkrow__label">{email}</span>
          {verified ? (
            <span className="acct-row acct-email__badge" data-tight>
              <span className="acct-badge" data-tone="ok">
                <AcctIcon name="check" size={14} strokeWidth={3} />
                {msg('account.verified')}
              </span>
            </span>
          ) : null}
        </div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {msg('account.changeEmail')}
        </Button>
      </div>
      <p className="acct-muted acct-small">{msg('account.weWillSendA')}</p>
      <Modal
        open={open}
        onClose={close}
        title={step === 'address' ? msg('account.changeYourEmail') : msg('account.enterTheCode')}
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
                {msg('account.cancel')}
              </Button>
              <Button type="submit" loading={busy}>
                {msg('account.sendCode')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="acct-dialog__form">
            <p className="acct-muted">{msg('account.weSentA6', { newEmail })}</p>
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
                {msg('account.cancel')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
