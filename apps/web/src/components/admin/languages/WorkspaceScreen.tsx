'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { WorkspaceRow } from '@/lib/i18n/admin-data';
import {
  approveTranslationsAction,
  loadDraftsAction,
  saveTranslationAction,
} from '@/app/admin/(shell)/languages/actions';
import { Button } from '../Button';
import { ImportDialog } from './ImportDialog';
import { Workspace, type MissingHit } from './Workspace';

export function WorkspaceScreen({
  locale,
  rows,
  canApprove,
  missingHits,
  initialQuery,
  hasDraft,
}: {
  locale: { code: string; endonym: string; englishName: string };
  rows: WorkspaceRow[];
  canApprove: boolean;
  missingHits?: MissingHit[];
  initialQuery?: string;
  /** The language has a sample draft that has not been reviewed by a native speaker. */
  hasDraft?: boolean;
}) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [draftNote, setDraftNote] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <>
      <p className="adm-lang-tools">
        <a
          className="adm-btn adm-btn--secondary"
          href={`/api/admin/languages/${locale.code}/export?format=csv`}
        >
          Export CSV
        </a>{' '}
        <a
          className="adm-btn adm-btn--secondary"
          href={`/api/admin/languages/${locale.code}/export?format=json`}
        >
          Export JSON
        </a>{' '}
        <Button variant="secondary" onClick={() => setImporting(true)}>
          Import CSV
        </Button>
        {hasDraft ? (
          <>
            {' '}
            <Button
              variant="secondary"
              onClick={async () => {
                const result = await loadDraftsAction(locale.code);
                if (result.ok) {
                  setDraftNote({
                    ok: true,
                    text: `Loaded ${result.added} sample drafts. They are not reviewed. Nothing is live until a native speaker checks each line and an Admin approves it.`,
                  });
                  router.refresh();
                } else setDraftNote({ ok: false, text: result.error });
              }}
            >
              Load sample draft
            </Button>
          </>
        ) : null}
      </p>
      {draftNote ? (
        <p role={draftNote.ok ? 'status' : 'alert'} className="adm-lang-note">
          {draftNote.text}
        </p>
      ) : null}
      <Workspace
        locale={locale}
        rows={rows}
        canApprove={canApprove}
        missingHits={missingHits}
        initialQuery={initialQuery}
        initialTab={initialQuery ? 'all' : 'missing'}
        onSave={async (key, text) => {
          const result = await saveTranslationAction(locale.code, key, text);
          if (result.ok) router.refresh();
          return result;
        }}
        onApprove={async (keys) => {
          const result = await approveTranslationsAction(locale.code, keys);
          router.refresh();
          return result;
        }}
      />
      <ImportDialog
        open={importing}
        locale={locale}
        onClose={() => setImporting(false)}
        onDone={() => router.refresh()}
      />
    </>
  );
}
