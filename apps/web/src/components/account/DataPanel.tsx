'use client';

import { useT } from '../../lib/i18n/provider';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, ButtonLink, Modal } from '@ad/ui';
import { deleteAccountAction, requestExportAction } from '../../app/actions';
import type { ExportState } from '../../lib/data';
import { NETWORK_MESSAGE } from '../auth/shared';
import { AcctField } from './Field';
import { AcctIcon } from './icons';

function askedFor(label: string | undefined): string {
  if (!label) return '';
  const lead = /^(today|yesterday)\b/i.test(label) ? '' : 'on ';
  return ` You asked for it ${lead}${label}.`;
}

/** S30: export and delete cards, the password dialog for each, and the closing message after a delete. */
export function DataPanel({ initial, email }: { initial: ExportState; email: string }) {
  const msg = useT();
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
      } else
        setProblem(
          result.reason === 'wrong_password'
            ? msg('account.passwordNotRight')
            : msg('account.exportFailed'),
        );
    } catch {
      setProblem(msg('account.exportFailed'));
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
      } else if (result.reason === 'wrong_password') setProblem(msg('account.passwordNotRight'));
      else if (result.reason === 'confirm') setProblem(msg('account.typeDeleteToConfirm'));
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
            ? msg('account.yourAccountHasBeen')
            : msg('account.yourAccountWillClose', { count: closed })}
        </h2>
        <p className="acct-muted">
          {closed === 0 ? msg('account.yourAccountAndIts') : msg('account.youAreSignedOut')}
        </p>
        <Button onClick={() => router.push('/')}>{msg('account.done')}</Button>
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
            {msg('account.exportMyData')}
          </h2>
        </div>
        {status === 'none' ? <p className="acct-muted">{msg('account.getAFileWith')}</p> : null}
        {status === 'pending' ? (
          <div className="acct-notice" role="status">
            <AcctIcon name="mail" size={20} />
            <span className="acct-notice__text">
              {msg('account.yourExportIsBeing', {
                email,
                value2: askedFor(exportState.requestedAt),
              })}
            </span>
          </div>
        ) : null}
        {status === 'failed' ? (
          <div className="acct-notice" data-tone="error" role="alert">
            <AcctIcon name="warning" size={20} />
            <span className="acct-notice__text">{msg('account.weCouldNotBuild')}</span>
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
              {msg('account.download')}
            </ButtonLink>
          </div>
        ) : null}
        {status === 'none' || status === 'failed' ? (
          <div>
            <Button onClick={() => setDialog('export')}>
              {status === 'failed' ? msg('account.tryAgain') : msg('account.requestExport')}
            </Button>
          </div>
        ) : null}
        {status === 'pending' ? (
          <div className="acct-row" data-wrap data-tight>
            <Button variant="secondary" disabled>
              {msg('account.requestExport')}
            </Button>
            <span className="acct-muted acct-small">{msg('account.anEarlierExportIs')}</span>
          </div>
        ) : null}
      </section>

      <section className="acct-card" data-gap="3" aria-labelledby="acct-activity">
        <div className="acct-card__title">
          <AcctIcon name="clock" size={24} />
          <h2 id="acct-activity" className="acct-h2">
            {msg('account.data.activityTitle')}
          </h2>
        </div>
        <p className="acct-muted">{msg('account.data.activityLead')}</p>
        <div>
          <a className="ad-btn" data-variant="secondary" data-size="md" href="/account/activity">
            {msg('account.data.activityOpen')}
          </a>
        </div>
      </section>

      <section className="acct-card" data-gap="3" data-tone="danger" aria-labelledby="acct-delete">
        <div className="acct-card__title">
          <AcctIcon name="trash" size={24} />
          <h2 id="acct-delete" className="acct-h2">
            {msg('account.deleteAccount')}
          </h2>
        </div>
        <p className="acct-muted">{msg('account.thisClosesYourAccount')}</p>
        <div>
          <Button variant="danger-outline" onClick={() => setDialog('delete')}>
            {msg('account.deleteAccount')}
          </Button>
        </div>
      </section>

      <Modal
        open={dialog === 'export'}
        onClose={close}
        title={msg('account.confirmYourPassword')}
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
              {msg('account.cancel')}
            </Button>
            <Button type="submit" loading={busy}>
              {msg('account.requestExport')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={dialog === 'delete'}
        onClose={close}
        title={msg('account.deleteYourAccount')}
        className="acct-dialog"
        hideClose
        dismissOnScrim={false}
        error={dialog === 'delete' ? (problem ?? undefined) : undefined}
      >
        <form className="acct-dialog__form" onSubmit={(e) => void onDelete(e)} noValidate>
          <p className="acct-muted">{msg('account.weWillSignYou')}</p>
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
              {msg('account.keepMyAccount')}
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={busy}
              aria-disabled={typed !== 'DELETE' || busy ? 'true' : undefined}
            >
              {msg('account.deleteMyAccount')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
