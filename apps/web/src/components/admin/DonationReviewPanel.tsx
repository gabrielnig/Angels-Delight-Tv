'use client';

import { useState } from 'react';
import { Button } from './Button';
import { TextArea } from './fields';
import { useCommand } from './useCommand';

type Resolve = (id: string, accept: boolean, note: string) => Promise<{ ok: true } | { ok: false; error: string }>;
type Reveal = (id: string) => Promise<{ ok: true; email: string } | { ok: false; error: string }>;

/** Staff tools for one gift: show the full email (audited) and settle a gift that needs review (needs a note). */
export function DonationReviewPanel({
  id,
  canResolve,
  inReview,
  resolve,
  reveal,
}: {
  id: string;
  canResolve: boolean;
  inReview: boolean;
  resolve: Resolve;
  reveal: Reveal;
}) {
  const { run, busy } = useCommand();
  const [note, setNote] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const ready = note.trim().length > 0;
  return (
    <div className="adm-stack">
      <section className="adm-card adm-stack" aria-label="Donor email">
        {email ? (
          <>
            <p className="adm-mono">{email}</p>
            <p className="adm-muted">This view was recorded in the audit log.</p>
          </>
        ) : (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              const r = await reveal(id);
              if (r.ok) setEmail(r.email);
              else setError(r.error);
            }}
          >
            Show full email
          </Button>
        )}
        {error ? <p role="alert">{error}</p> : null}
      </section>
      {canResolve && inReview ? (
        <section className="adm-card adm-stack" aria-label="Settle this gift">
          <TextArea
            label="Note"
            hint="Say what you checked and why. It is kept with the gift and in the audit log."
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {!ready ? <p className="adm-muted">Write a note first. Both buttons stay off until you do.</p> : null}
          <div className="adm-row">
            <Button
              variant="primary"
              loading={busy}
              disabled={!ready}
              onClick={() => run(() => resolve(id, true, note), 'Gift accepted')}
            >
              Accept the gift
            </Button>
            <Button
              variant="danger"
              disabled={!ready || busy}
              onClick={() => run(() => resolve(id, false, note), 'Gift rejected')}
            >
              Reject the gift
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
