'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { LanguageRow } from '@/lib/i18n/admin-data';
import { Badge, type BadgeTone } from '../Badge';
import { Dialog } from '../Dialog';
import { TextField } from '../fields';
import { Switch } from '../fields';
import { Banner } from '../states';

type Result = { ok: true } | { ok: false; error: string };

const STATE: Record<LanguageRow['state'], { label: string; tone: BadgeTone; icon: 'check' | 'clock' | 'close' }> = {
  live: { label: 'Live', tone: 'success', icon: 'check' },
  draft: { label: 'Draft', tone: 'warning', icon: 'clock' },
  off: { label: 'Off', tone: 'neutral', icon: 'close' },
};

export function LanguageTable({
  rows,
  canPublish,
  canOverride,
  onPublish,
  onUnpublish,
}: {
  rows: LanguageRow[];
  canPublish: boolean;
  canOverride: boolean;
  onPublish: (code: string, override?: { reason: string }) => Promise<Result>;
  onUnpublish: (code: string) => Promise<Result>;
}) {
  const [overriding, setOverriding] = useState<LanguageRow | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const none = rows.every((r) => r.state !== 'live');

  async function toggle(row: LanguageRow, next: boolean) {
    setError(undefined);
    const result = next ? await onPublish(row.code) : await onUnpublish(row.code);
    if (!result.ok) setError(result.error);
  }

  async function confirmOverride() {
    if (!overriding) return;
    const result = await onPublish(overriding.code, { reason: reason.trim() });
    if (result.ok) {
      setOverriding(null);
      setReason('');
    } else setError(result.error);
  }

  return (
    <>
      {none ? (
        <Banner tone="info">Only English is live. Viewers see no language picker until a language is published.</Banner>
      ) : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <div className="adm-card adm-table-card">
        <table className="adm-table adm-table--always adm-table--sticky">
          <caption className="adm-sr">Languages</caption>
          <thead>
            <tr>
              <th scope="col">Language</th>
              <th scope="col">State</th>
              <th scope="col" className="adm-num">Approved</th>
              <th scope="col" className="adm-num">Missing</th>
              <th scope="col" className="adm-num">Stale</th>
              <th scope="col" className="adm-num">In review</th>
              <th scope="col">Live</th>
              <th scope="col">Work</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const s = STATE[row.state];
              const reasonId = `reason-${row.code}`;
              const blocked = row.state !== 'live' && !row.canPublish;
              return (
                <tr key={row.code} aria-label={`${row.endonym}, ${row.englishName}`}>
                  <th scope="row">
                    <span lang={row.code}>{row.endonym}</span>
                    <span className="adm-muted"> {row.englishName}</span>
                  </th>
                  <td>
                    <Badge tone={s.tone} icon={s.icon}>
                      {s.label}
                    </Badge>
                  </td>
                  <td className="adm-num">{`${row.percent}%`}</td>
                  <td className="adm-num">{row.missing}</td>
                  <td className="adm-num">{row.stale}</td>
                  <td className="adm-num">{row.inReview}</td>
                  <td>
                    <Switch
                      label={`${row.endonym} live for viewers`}
                      checked={row.state === 'live'}
                      disabled={!canPublish || blocked}
                      onChange={(next) => void toggle(row, next)}
                    />
                    {blocked && row.reason ? (
                      <p className="adm-muted" id={reasonId}>
                        {row.reason}
                      </p>
                    ) : null}
                    {blocked && canOverride ? (
                      <button type="button" className="adm-link" onClick={() => setOverriding(row)}>
                        Publish anyway
                      </button>
                    ) : null}
                  </td>
                  <td>
                    <Link className="adm-link" href={`/admin/languages/${row.code}`}>
                      Translate
                    </Link>{' '}
                    <a className="adm-link" href={`/api/admin/languages/${row.code}/export?format=csv`}>
                      Export CSV
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Dialog
        open={overriding !== null}
        onClose={() => setOverriding(null)}
        title={overriding ? `Publish ${overriding.englishName} below the threshold` : 'Publish'}
        description="Viewers will see English for any text that is not translated yet. This is recorded in the audit log."
        footer={
          <>
            <button type="button" className="adm-btn adm-btn--secondary" onClick={() => setOverriding(null)}>
              Cancel
            </button>
            <button type="button" className="adm-btn adm-btn--primary" disabled={reason.trim().length < 3} onClick={() => void confirmOverride()}>
              Publish
            </button>
          </>
        }
      >
        <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Dialog>
    </>
  );
}
