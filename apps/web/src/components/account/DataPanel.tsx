'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, ButtonLink, Modal } from '@ad/ui';
import { deleteAccountAction, requestExportAction } from '../../app/actions';
import type { ExportState } from '../../lib/data';
import { NETWORK_MESSAGE } from '../auth/shared';
import { AcctField } from './Field';
import { AcctIcon } from './icons';

const WRONG_PASSWORD = 'Password is not right.';
const EXPORT_FAILED = 'We could not start your export. Try again.';

function askedFor(label: string | undefined): string {
  if (!label) return '';
  const lead = /^(today|yesterday)\b/i.test(label) ? '' : 'on ';
  return ` You asked for it ${lead}${label}.`;
}

/** S30: export and delete cards, the password dialog for each, and the closing message after a delete. */
export function DataPanel({ initial, email }: { initial: ExportState; email: string }) {
  const router = useRouter();
  const [exportState, setExportState] = useState(initial);
  const [dialog, setDialog] = useState<'export' | 'delete' | null>(null);
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState<number | null>(null);

  function close() {
    setDialog(null);
    setPassword('');
    setTyped('');
    setProblem(null);
  }

  async function onExport(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const result = await requestExportAction({ password });
      if (result.ok) {
        setExportState(result.state);
        close();
      } else setProblem(result.reason === 'wrong_password' ? WRONG_PASSWORD : EXPORT_FAILED);
    } catch {
      setProblem(EXPORT_FAILED);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(event: FormEvent) {
    event.preventDefault();
    if (typed !== 'DELETE') return;
    setBusy(true);
    setProblem(null);
    try {
      const result = await deleteAccountAction({ password, confirm: typed });
      if (result.ok) {
        close();
        setClosed(result.days);
      } else if (result.reason === 'wrong_password') setProblem(WRONG_PASSWORD);
      else if (result.reason === 'confirm') setProblem('Type DELETE to confirm.');
      else setProblem(NETWORK_MESSAGE);
    } catch {
      setProblem(NETWORK_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  if (closed !== null) {
    return (
      <section className="acct-card acct-closing" aria-live="polite">
        <h2 className="acct-h2">
          {closed === 0
            ? 'Your account has been deleted'
            : `Your account will close in ${closed} ${closed === 1 ? 'day' : 'days'}`}
        </h2>
        <p className="acct-muted">
          {closed === 0
            ? 'Your account and its data have been deleted. You are now signed out.'
            : 'You are signed out everywhere. We emailed you a link to cancel before then.'}
        </p>
        <Button onClick={() => router.push('/')}>Done</Button>
      </section>
    );
  }

  const { status } = exportState;
  return (
    <>
      <section className="acct-card" data-gap="3" aria-labelledby="acct-export">
        <div className="acct-card__title">
          <AcctIcon name="download" size={24} />
          <h2 id="acct-export" className="acct-h2">
            Export my data
          </h2>
        </div>
        {status === 'none' ? (
          <p className="acct-muted">
            Get a file with your account, profiles, My List and watch progress. We email you a link
            that works for 24 hours. It never includes your password.
          </p>
        ) : null}
        {status === 'pending' ? (
          <div className="acct-notice" role="status">
            <AcctIcon name="mail" size={20} />
            <span className="acct-notice__text">{`Your export is being built. We will email ${email} when it is ready.${askedFor(exportState.requestedAt)}`}</span>
          </div>
        ) : null}
        {status === 'failed' ? (
          <div className="acct-notice" data-tone="error" role="alert">
            <AcctIcon name="warning" size={20} />
            <span className="acct-notice__text">
              We could not build your export. Nothing was lost. Try again.
            </span>
          </div>
        ) : null}
        {status === 'ready' && exportState.downloadHref ? (
          <div className="acct-file">
            <div className="acct-col">
              <span className="acct-file__name">{exportState.fileName ?? 'export'}</span>
              <span className="acct-muted acct-small">{`${exportState.sizeLabel ?? ''}, link works until ${exportState.expiresLabel ?? 'tomorrow'}`}</span>
            </div>
            <ButtonLink href={exportState.downloadHref}>
              <AcctIcon name="download" size={18} />
              Download
            </ButtonLink>
          </div>
        ) : null}
        {status === 'none' || status === 'failed' ? (
          <div>
            <Button onClick={() => setDialog('export')}>
              {status === 'failed' ? 'Try again' : 'Request export'}
            </Button>
          </div>
        ) : null}
        {status === 'pending' ? (
          <div className="acct-row" data-wrap data-tight>
            <Button variant="secondary" disabled>
              Request export
            </Button>
            <span className="acct-muted acct-small">
              An earlier export is still valid, so a new one is not needed.
            </span>
          </div>
        ) : null}
      </section>

      <section className="acct-card" data-gap="3" data-tone="danger" aria-labelledby="acct-delete">
        <div className="acct-card__title">
          <AcctIcon name="trash" size={24} />
          <h2 id="acct-delete" className="acct-h2">
            Delete account
          </h2>
        </div>
        <p className="acct-muted">
          This closes your account and removes your profiles, My List and watch progress. You have
          14 days to change your mind. After that it cannot be undone.
        </p>
        <div>
          <Button variant="danger-outline" onClick={() => setDialog('delete')}>
            Delete account
          </Button>
        </div>
      </section>

      <Modal
        open={dialog === 'export'}
        onClose={close}
        title="Confirm your password"
        className="acct-dialog"
        hideClose
        dismissOnScrim={false}
        error={dialog === 'export' ? (problem ?? undefined) : undefined}
      >
        <form className="acct-dialog__form" onSubmit={(e) => void onExport(e)} noValidate>
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
              Request export
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={dialog === 'delete'}
        onClose={close}
        title="Delete your account?"
        className="acct-dialog"
        hideClose
        dismissOnScrim={false}
        error={dialog === 'delete' ? (problem ?? undefined) : undefined}
      >
        <form className="acct-dialog__form" onSubmit={(e) => void onDelete(e)} noValidate>
          <p className="acct-muted">
            We will sign you out everywhere and email you a link to cancel. You have 14 days. Then
            everything is removed.
          </p>
          <AcctField
            label="Your password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <AcctField
            label="Type DELETE to confirm"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <div className="acct-dialog__actions">
            <Button variant="secondary" onClick={close}>
              Keep my account
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={busy}
              aria-disabled={typed !== 'DELETE' || busy ? 'true' : undefined}
            >
              Delete my account
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
