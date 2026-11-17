'use client';

import { useState, type FormEvent } from 'react';
import { Banner, Button, Input, PasswordField } from '@ad/ui';
import { deleteAccountAction, requestExportAction } from '../../app/actions';
import type { ExportState } from '../../lib/data';

export function DataPanel({ initial }: { initial: ExportState }) {
  const [exportState, setExportState] = useState(initial);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);

  async function onExport() {
    try {
      setExportState(await requestExportAction());
    } catch {
      setMessage({ tone: 'danger', text: 'We could not start your export. Try again.' });
    }
  }

  async function onDelete(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await deleteAccountAction({ password, confirm });
      if (result.ok)
        setMessage({
          tone: 'success',
          text: `Your account will be deleted in ${result.days} days. Sign in before then to cancel.`,
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
        {exportState.status === 'pending' ? (
          <p role="status">Your export is being prepared.</p>
        ) : null}
        {exportState.status === 'ready' && exportState.downloadHref ? (
          <p>
            <a href={exportState.downloadHref}>{`Download ${exportState.fileName ?? 'export'}`}</a>{' '}
            {exportState.sizeLabel}
          </p>
        ) : null}
        {exportState.status === 'failed' ? (
          <Banner tone="danger">The last export failed. Try again.</Banner>
        ) : null}
        <Button
          variant="secondary"
          onClick={() => void onExport()}
          disabled={exportState.status === 'pending'}
        >
          Request export
        </Button>
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
