'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SponsorStoredStatus } from '@ad/shared';
import { Button } from './Button';
import { ConfirmDialog } from './Dialog';
import { useCommand } from './useCommand';

type R = { ok: true } | { ok: false; error: string };

/** Approve, pause, archive or delete. Approving and archiving need an Admin (D-263). */
export function SponsorStatusPanel({
  status,
  isAdmin,
  setStatus,
  remove,
}: {
  status: SponsorStoredStatus;
  isAdmin: boolean;
  setStatus: (status: SponsorStoredStatus) => Promise<R>;
  remove: () => Promise<R>;
}) {
  const { run, busy } = useCommand();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const go = (to: SponsorStoredStatus, done: string) => run(() => setStatus(to), done);
  return (
    <section className="adm-card adm-stack" aria-label="Sponsor status">
      <div className="adm-row">
        {status !== 'active' ? (
          <Button variant="primary" disabled={!isAdmin || busy} onClick={() => go('active', 'Sponsor approved.')}>
            Approve to run
          </Button>
        ) : (
          <Button variant="secondary" disabled={busy} onClick={() => go('paused', 'Sponsor paused.')}>
            Pause
          </Button>
        )}
        {status !== 'archived' ? (
          <Button variant="secondary" disabled={!isAdmin || busy} onClick={() => go('archived', 'Sponsor archived.')}>
            Archive
          </Button>
        ) : null}
        <Button variant="danger" disabled={!isAdmin || busy} onClick={() => setDeleting(true)}>
          Delete sponsor
        </Button>
      </div>
      {!isAdmin ? <p className="adm-muted">Only an Admin can approve, archive or delete a sponsor.</p> : null}
      <ConfirmDialog
        open={deleting}
        title="Delete this sponsor?"
        consequence="Its creatives are deleted too. A sponsor with report numbers cannot be deleted: archive it instead."
        confirmLabel="Delete"
        danger
        busy={busy}
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          const r = await run(remove, 'Sponsor deleted.');
          if (r.ok) router.push('/admin/sponsors');
          setDeleting(false);
        }}
      />
    </section>
  );
}
