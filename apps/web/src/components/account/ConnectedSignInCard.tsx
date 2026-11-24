'use client';

import { useState, type FormEvent } from 'react';
import { Button, Modal } from '@ad/ui';
import { msg } from '@ad/shared/messages';
import { unlinkGoogleAction } from '../../app/actions-google';
import { AcctField } from './Field';
import { AcctIcon } from './icons';

export interface GoogleCardState {
  linked: boolean;
  /** Masked, such as j***@gmail.com. */
  hint: string | null;
  hasPassword: boolean;
}

type Unlink = (
  password: string,
) => Promise<
  | { ok: true }
  | { ok: false; reason: 'wrong_password' | 'set_password' | 'network' }
  | { ok: false; reason: 'locked'; minutes: number }
>;

/** The Google row of the Security screen (S170, S181): connect, or remove once another way in exists. */
export function ConnectedSignInCard({
  initial,
  unlink = unlinkGoogleAction,
  onChanged,
}: {
  initial: GoogleCardState;
  unlink?: Unlink;
  onChanged?: (change: 'removed') => void;
}) {
  const [state, setState] = useState(initial);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(false);
    setPassword('');
    setProblem(null);
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setProblem(null);
    try {
      const result = await unlink(password);
      if (result.ok) {
        setState({ ...state, linked: false, hint: null });
        close();
        onChanged?.('removed');
        return;
      }
      setProblem(
        result.reason === 'wrong_password'
          ? msg('account.google.unlinkWrong')
          : result.reason === 'locked'
            ? msg('account.google.locked', {
                wait: msg('auth.wait.minutes', { count: result.minutes }),
              })
            : msg('account.google.failed'),
      );
    } catch {
      setProblem(msg('account.google.failed'));
    } finally {
      setBusy(false);
    }
  }

  const needsPassword = !state.hasPassword;

  return (
    <section className="acct-card" data-gap="2" aria-labelledby="acct-google">
      <h2 id="acct-google" className="acct-h2">
        {msg('account.google.title')}
      </h2>
      <p className="acct-muted acct-small">{msg('account.google.lead')}</p>
      <div className="acct-device">
        <div className="acct-device__lead">
          <AcctIcon name="info" size={24} />
          <div className="acct-col">
            <span className="acct-device__label">{msg('account.google.rowName')}</span>
            <span className="acct-muted acct-small">
              {state.linked
                ? msg('account.google.connected', { hint: state.hint ?? '' })
                : msg('account.google.notConnected')}
            </span>
          </div>
        </div>
        {state.linked ? (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            {msg('account.google.unlink')}
          </Button>
        ) : (
          <a
            className="ad-btn"
            data-variant="secondary"
            data-size="md"
            href="/api/auth/google/start?link=1"
          >
            {msg('account.google.connect')}
          </a>
        )}
      </div>

      <Modal
        open={open}
        onClose={close}
        title={
          needsPassword ? msg('account.google.setPasswordTitle') : msg('account.google.unlinkTitle')
        }
        className="acct-dialog"
        hideClose
        footer={
          needsPassword ? (
            <>
              <Button variant="secondary" onClick={close}>
                {msg('account.google.unlinkCancel')}
              </Button>
              <a className="ad-btn" data-variant="primary" data-size="md" href="/forgot-password">
                {msg('account.google.setPasswordAction')}
              </a>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={close}>
                {msg('account.google.unlinkCancel')}
              </Button>
              <Button variant="danger" loading={busy} onClick={() => void submit()}>
                {msg('account.google.unlinkConfirm')}
              </Button>
            </>
          )
        }
      >
        {needsPassword ? (
          <p className="acct-muted">{msg('account.google.setPasswordLead')}</p>
        ) : (
          <form className="acct-form" onSubmit={(event) => void submit(event)} noValidate>
            <p className="acct-muted">{msg('account.google.unlinkLead')}</p>
            <AcctField
              label={msg('account.google.unlinkPassword')}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={problem ?? undefined}
            />
          </form>
        )}
      </Modal>
    </section>
  );
}
