'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { WorkspaceRow } from '@/lib/i18n/admin-data';
import {
  approveTranslationsAction,
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
}: {
  locale: { code: string; endonym: string; englishName: string };
  rows: WorkspaceRow[];
  canApprove: boolean;
  missingHits?: MissingHit[];
}) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  return (
    <>
      <p className="adm-lang-tools">
        <a className="adm-btn adm-btn--secondary" href={`/api/admin/languages/${locale.code}/export?format=csv`}>
          Export CSV
        </a>{' '}
        <a className="adm-btn adm-btn--secondary" href={`/api/admin/languages/${locale.code}/export?format=json`}>
          Export JSON
        </a>{' '}
        <Button variant="secondary" onClick={() => setImporting(true)}>
          Import CSV
        </Button>
      </p>
      <Workspace
        locale={locale}
        rows={rows}
        canApprove={canApprove}
        missingHits={missingHits}
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
