'use client';

import { useMemo, useState } from 'react';
import { validateTranslation, type MessageText } from '@ad/shared/messages';
import { filterWorkspaceRows, type WorkspaceRow } from '@/lib/i18n/admin-data';
import { Button } from '../Button';
import { SelectField } from '../fields';
import { Banner, EmptyState } from '../states';
import { Tabs } from '../Tabs';
import { TranslationRow } from './TranslationRow';

type SaveResult = { ok: true; warnings: string[] } | { ok: false; error: string };
export interface MissingHit {
  key: string;
  hits: number;
  lastSeen: string;
}

export function Workspace({
  locale,
  rows,
  canApprove,
  onSave,
  onApprove,
  missingHits,
  initialQuery = '',
  initialTab = 'missing',
}: {
  locale: { code: string; endonym: string; englishName: string };
  rows: WorkspaceRow[];
  canApprove: boolean;
  onSave: (key: string, text: MessageText) => Promise<SaveResult>;
  onApprove: (keys: string[]) => Promise<{ approved: number; skipped: { key: string; reason: string }[] }>;
  /** Keys viewers hit in English, most hit first. Adds the Viewer hits tab. */
  missingHits?: MissingHit[];
  initialQuery?: string;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(initialTab);
  const [q, setQ] = useState(initialQuery);
  const [area, setArea] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<string>();

  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const areas = useMemo(() => [...new Set(rows.map((r) => r.area))], [rows]);
  const shown = filterWorkspaceRows(rows, { status: tab === 'hits' ? 'all' : tab, area, q });
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const warningCount = [...picked].filter((key) => {
    const row = byKey.get(key);
    if (!row?.text) return false;
    return validateTranslation({ key, locale: locale.code, english: row.english, text: row.text }).warnings.length > 0;
  }).length;

  async function approve() {
    const keys = rows.filter((r) => picked.has(r.key)).map((r) => r.key);
    const result = await onApprove(keys);
    setNote(`Approved ${result.approved}.${result.skipped.length > 0 ? ` Skipped ${result.skipped.length}: ${result.skipped.map((s) => `${s.key} (${s.reason})`).join(', ')}` : ''}`);
    setPicked(new Set());
  }

  const tabs = [
    { id: 'missing', label: `Missing ${count('missing')}` },
    { id: 'stale', label: `Stale ${count('stale')}` },
    { id: 'in_review', label: `In review ${count('in_review')}` },
    { id: 'approved', label: `Approved ${count('approved')}` },
    { id: 'all', label: `All ${rows.length}` },
    ...(missingHits ? [{ id: 'hits', label: `Viewer hits ${missingHits.length}` }] : []),
  ];

  return (
    <div className="adm-lang-workspace">
      <div className="adm-lang-workspace__filters">
        <input type="search" className="adm-input" role="searchbox" aria-label="Search keys and text" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <SelectField
          label="Area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          options={[{ value: '', label: 'All areas' }, ...areas.map((a) => ({ value: a, label: a }))]}
        />
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} label={`${locale.englishName} translation filters`}>
        {tab === 'hits' && missingHits ? (
          <ol className="adm-lang-hits">
            {missingHits.map((h) => (
              <li key={h.key}>
                <a href={`?q=${encodeURIComponent(h.key)}`}>{h.key}</a> {`${h.hits} hits, last seen ${h.lastSeen}`}
              </li>
            ))}
          </ol>
        ) : shown.length === 0 ? (
          <EmptyState title="Nothing here." help="No text matches this filter." live />
        ) : (
          <ul className="adm-lang-list">
            {shown.map((row) => (
              <TranslationRow
                key={row.key}
                row={row}
                locale={locale.code}
                canSelect={canApprove}
                selected={picked.has(row.key)}
                onSelect={(on) => {
                  const next = new Set(picked);
                  if (on) next.add(row.key);
                  else next.delete(row.key);
                  setPicked(next);
                }}
                onSave={onSave}
              />
            ))}
          </ul>
        )}
      </Tabs>
      {note ? <Banner tone="info">{note}</Banner> : null}
      {canApprove && picked.size > 0 ? (
        <div className="adm-bulkbar" role="region" aria-label="Bulk actions">
          <span>{`${picked.size} selected`}</span>
          {warningCount > 0 ? <span>{`${warningCount} has a length warning`}</span> : null}
          <Button variant="primary" onClick={() => void approve()}>{`Approve ${picked.size}`}</Button>
        </div>
      ) : null}
    </div>
  );
}
