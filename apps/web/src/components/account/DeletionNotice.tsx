'use client';

import { useState } from 'react';
import { Banner, Button } from '@ad/ui';

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
    <div className="web-form web-form--center">
      <h1 className="web-page__title">Your account is set to close</h1>
      <p>
        {`It will be removed on ${purgeDate}, in ${days} ${days === 1 ? 'day' : 'days'}. Cancel now and everything comes back as it was.`}
      </p>
      {outcome === 'restored' ? (
        <Banner tone="success">Your account is back. Opening your profiles.</Banner>
      ) : null}
      {outcome === 'failed' ? (
        <Banner tone="danger">We could not cancel the deletion. Try again.</Banner>
      ) : null}
      <div className="web-form__actions">
        <Button onClick={() => void cancel()} loading={busy}>
          Cancel deletion
        </Button>
        <Button variant="ghost" onClick={() => void onSignOut()}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
