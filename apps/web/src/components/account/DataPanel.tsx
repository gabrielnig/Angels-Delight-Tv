'use client';

import { useState, type FormEvent } from 'react';
import { Banner, Button, Input, PasswordField } from '@ad/ui';
import { deleteAccountAction, requestExportAction } from '../../app/actions';
import type { ExportState } from '../../lib/data';

export function DataPanel({ initial }: { initial: ExportState }) {
  const [exportState, setExportState] = useState(initial);
  const [exportPassword, setExportPassword] = useState('');
  const [exportProblem, setExportProblem] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);

  async function onExport(event: FormEvent) {
    event.preventDefault();
    setExportProblem(null);
    setExportNote(null);
    try {
      const result = await requestExportAction({ password: exportPassword });
      if (result.ok) {
        setExportState(result.state);
        setExportPassword('');
        if (result.already)
          setExportNote('An earlier export is still valid, so a new one is not needed.');
      } else if (result.reason === 'wrong_password') {
        setExportProblem('That password is not right.');
      } else {
        setExportProblem('We could not start your export. Try again.');
      }
    } catch {
      setExportProblem('We could not start your export. Try again.');
    }
  }

  async function onDelete(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await deleteAccountAction({ password, confirm });
      if (result.ok)
        setMessage({
          tone: 'success',
          text:
            result.days === 0
              ? 'Your account and its data have been deleted. You are now signed out.'
              : `Your account will be deleted in ${result.days} days. Sign in before then to cancel.`,
        });
      else if (result.reason === 'wrong_password')
        setMessage({ tone: 'danger', text: 'That password is not right.' });
      else if (result.reason === 'confirm')
        setMessage({ tone: 'danger', text: 'Type DELETE to confirm.' });
      else setMessage({ tone: 'danger', text: 'We could not reach the server. Try again.' });
    } catch {
      setMessage({ tone: 'danger', text: 'We could not reach the server. Try again.' });
    }
  }

  return (
    <div className="web-form">
      <section>
        <h2>Download your data</h2>
        <p className="web-form__fine">
          Get a file with your account, profiles, My List and watch progress. We email you a link
          that works for 24 hours. It never includes your password.
        </p>
        {exportState.status === 'pending' ? (
          <p role="status">
            {`Your export is being built. We will email you when it is ready.${exportState.requestedAt ? ` You asked for it on ${exportState.requestedAt}.` : ''}`}
          </p>
        ) : null}
        {exportState.status === 'ready' && exportState.downloadHref ? (
          <p>
            <a href={exportState.downloadHref}>{`Download ${exportState.fileName ?? 'export'}`}</a>{' '}
            {`${exportState.sizeLabel ?? ''}, link works until ${exportState.expiresLabel ?? 'tomorrow'}`}
          </p>
        ) : null}
        {exportState.status === 'failed' ? (
          <Banner tone="danger">
            We could not build your export. Nothing was lost. Try again.
          </Banner>
        ) : null}
        {exportNote ? <Banner tone="info">{exportNote}</Banner> : null}
        <form className="web-form" onSubmit={(event) => void onExport(event)}>
          <PasswordField
            label="Password to confirm the export"
            value={exportPassword}
            onChange={(e) => setExportPassword(e.target.value)}
            error={exportProblem ?? undefined}
          />
          <Button type="submit" variant="secondary" disabled={exportState.status === 'pending'}>
            {exportState.status === 'failed' ? 'Try again' : 'Request export'}
          </Button>
        </form>
      </section>
      <section>
        <h2>Delete account</h2>
        {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
        <form className="web-form" onSubmit={(event) => void onDelete(event)}>
          <PasswordField
            label="Account password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label="Type DELETE to confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button type="submit" variant="danger">
            Delete my account
          </Button>
        </form>
      </section>
    </div>
  );
}
