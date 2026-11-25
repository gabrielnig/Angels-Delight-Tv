'use client';

import { useId, useState } from 'react';
import { validateTranslation, type MessageText } from '@ad/shared/messages';
import type { WorkspaceRow } from '@/lib/i18n/admin-data';
import { Badge, type BadgeTone } from '../Badge';
import { Button } from '../Button';

type SaveResult = { ok: true; warnings: string[] } | { ok: false; error: string };

const STATUS: Record<WorkspaceRow['status'], { label: string; tone: BadgeTone; icon: 'check' | 'clock' | 'alert' | 'file' | 'close' }> = {
  approved: { label: 'Approved', tone: 'success', icon: 'check' },
  in_review: { label: 'In review', tone: 'info', icon: 'clock' },
  draft: { label: 'Draft', tone: 'warning', icon: 'file' },
  stale: { label: 'Source changed', tone: 'warning', icon: 'alert' },
  missing: { label: 'Missing', tone: 'neutral', icon: 'close' },
};

const toDraft = (row: WorkspaceRow): Record<string, string> => {
  if (row.categories.length === 0) return { other: typeof row.text === 'string' ? row.text : '' };
  const t = typeof row.text === 'object' && row.text ? (row.text as Record<string, string>) : {};
  return Object.fromEntries(row.categories.map((c) => [c, t[c] ?? '']));
};

export function flatLength(text: MessageText): number {
  return typeof text === 'string' ? text.length : Math.max(...Object.values(text).map((v) => String(v).length), 0);
}

export function TranslationRow({
  row,
  locale,
  selected,
  canSelect,
  onSelect,
  onSave,
}: {
  row: WorkspaceRow;
  locale: string;
  selected: boolean;
  canSelect: boolean;
  onSelect: (on: boolean) => void;
  onSave: (key: string, text: MessageText) => Promise<SaveResult>;
}) {
  const id = useId();
  const initial = toDraft(row);
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [serverError, setServerError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const plural = row.categories.length > 0;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const value: MessageText = plural ? ({ other: '', ...draft } as MessageText) : (draft.other ?? '');
  const blank = Object.values(draft).every((v) => v.trim() === '');
  const result = blank ? null : validateTranslation({ key: row.key, locale, english: row.english, text: value });
  const errors = serverError ? [serverError] : (result?.errors ?? []);
  const warnings = result?.warnings ?? [];
  const status = STATUS[row.status];
  const english = typeof row.english === 'string' ? row.english : Object.values(row.english).join(' / ');

  async function save() {
    setBusy(true);
    setServerError(undefined);
    const outcome = await onSave(row.key, value);
    setBusy(false);
    if (outcome.ok) setSaved(draft);
    else setServerError(outcome.error);
  }

  return (
    <li className="adm-lang-row" data-testid={`row-${row.key}`} data-status={row.status}>
      <div className="adm-lang-row__head">
        {canSelect && (row.status === 'in_review' || row.status === 'draft') ? (
          <input type="checkbox" aria-label={`Select ${row.key}`} checked={selected} onChange={(e) => onSelect(e.target.checked)} />
        ) : null}
        <code className="adm-lang-row__key">{row.key}</code>
        <Badge tone={status.tone} icon={status.icon}>
          {status.label}
        </Badge>
      </div>
      <p className="adm-lang-row__english" lang="en">
        {english}
      </p>
      {row.placeholders.length > 0 ? (
        <p className="adm-lang-row__chips">
          {row.placeholders.map((p) => (
            <span key={p} className="adm-chip">{`{${p}}`}</span>
          ))}
        </p>
      ) : null}
      {Object.keys(draft).map((cat) => {
        const fieldId = `${id}-${cat}`;
        return (
          <div key={cat} className="adm-lang-row__field">
            {plural ? (
              <label htmlFor={fieldId} className="adm-field__label">
                {cat}
              </label>
            ) : (
              <label htmlFor={fieldId} className="adm-sr">{`Translation of ${row.key}`}</label>
            )}
            <textarea
              id={fieldId}
              className="adm-textarea"
              lang={locale}
              rows={2}
              value={draft[cat]}
              aria-invalid={errors.length > 0 || undefined}
              aria-describedby={errors.length > 0 ? `${id}-error` : undefined}
              onChange={(e) => setDraft({ ...draft, [cat]: e.target.value })}
            />
          </div>
        );
      })}
      {errors.length > 0 ? (
        <p className="adm-field__error" id={`${id}-error`} role="alert">
          {errors.join('. ')}
        </p>
      ) : warnings.length > 0 ? (
        <p className="adm-field__hint">{warnings.join('. ')}</p>
      ) : null}
      <div className="adm-lang-row__actions">
        <span className="adm-muted">{`${Object.values(draft).reduce((n, v) => Math.max(n, v.length), 0)} of ${flatLength(row.english)} characters in English`}</span>
        <Button
          variant="ghost"
          onClick={() => setDraft(plural ? Object.fromEntries(row.categories.map((c) => [c, typeof row.english === 'object' ? ((row.english as Record<string, string>)[c] ?? row.english.other) : ''])) : { other: String(row.english) })}
        >
          Copy English
        </Button>
        <Button variant="primary" loading={busy} disabled={!dirty || blank || errors.length > 0} onClick={() => void save()}>
          Save
        </Button>
      </div>
    </li>
  );
}
