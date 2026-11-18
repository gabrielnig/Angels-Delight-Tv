'use client';

import { useState } from 'react';
import { Button } from '@ad/ui';
import { AcctIcon } from './icons';

type Result = { ok: true } | { ok: false };

/** S30 state 6: the only screen a signed in account waiting to be deleted can reach (M02-S08 AC2). */
export function DeletionNotice({
  purgeDate,
  days,
  onCancel,
  onSignOut,
}: {
  purgeDate: string;
  days: number;
  onCancel: () => Promise<Result>;
  onSignOut: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<'restored' | 'failed' | null>(null);

  async function cancel() {
    setBusy(true);
    setOutcome(null);
    try {
      const result = await onCancel();
      setOutcome(result.ok ? 'restored' : 'failed');
    } catch {
      setOutcome('failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="acct-closing" data-screen="pending">
      <div className="acct-closing__icon">
        <AcctIcon name="trash" size={32} />
      </div>
      <h1 className="acct__title">Your account is set to close</h1>
      <p className="acct-muted">
        {`It will be removed on ${purgeDate}, in ${days} ${days === 1 ? 'day' : 'days'}. Cancel now and everything comes back as it was.`}
      </p>
      {outcome === 'restored' ? (
        <div className="acct-notice" role="status">
          <AcctIcon name="check" size={20} />
          <span className="acct-notice__text">Your account is back. Opening your profiles.</span>
        </div>
      ) : null}
      {outcome === 'failed' ? (
        <div className="acct-notice" data-tone="error" role="alert">
          <AcctIcon name="warning" size={20} />
          <span className="acct-notice__text">We could not cancel the deletion. Try again.</span>
        </div>
      ) : null}
      <div className="acct-dialog__actions" data-center>
        <Button onClick={() => void cancel()} loading={busy}>
          Cancel deletion
        </Button>
        <Button variant="secondary" onClick={() => void onSignOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
