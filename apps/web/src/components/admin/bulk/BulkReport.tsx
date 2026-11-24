'use client';

import { useEffect, useRef } from 'react';
import { describeOutcome, retryableFailures, type BulkOutcome } from '@/lib/data/admin/bulk';
import { Banner } from '../states';

/** Plain text of every failed and skipped item, one per line: "Title: reason". */
export function reportText(outcome: BulkOutcome, itemLabel: (id: string) => string): string {
  return [...outcome.failed, ...outcome.skipped].map((i) => `${itemLabel(i.id)}: ${i.reason}`).join('\n');
}

/**
 * The results panel (M42-S04). Shown in place after a run that had failures, skips or an interruption.
 * Retry covers only failures marked retryable. Skipped items are never retried.
 */
export function BulkReport({
  label,
  outcome,
  itemLabel,
  itemHref,
  onDismiss,
  onRetry,
  onContinue,
}: {
  label: string;
  outcome: BulkOutcome;
  itemLabel: (id: string) => string;
  itemHref?: (id: string) => string;
  onDismiss: () => void;
  onRetry?: (ids: string[]) => void;
  onContinue?: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [outcome]);

  const issues = [...outcome.failed.map((i) => ({ ...i, kind: 'failed' })), ...outcome.skipped.map((i) => ({ ...i, kind: 'skipped' }))];
  if (issues.length === 0 && !outcome.interrupted) return null;

  const tone = outcome.succeeded.length === 0 && outcome.failed.length > 0 ? 'danger' : 'warning';
  const retry = retryableFailures(outcome);

  return (
    <Banner tone={tone}>
      <div className="adm-bulk-report">
        <h3 className="adm-h3" tabIndex={-1} ref={heading}>
          {describeOutcome(label, outcome)}
        </h3>
        {outcome.interrupted ? (
          <p>
            Done {outcome.interrupted.done} of {outcome.interrupted.total} before the connection dropped.
          </p>
        ) : null}
        {issues.length > 0 ? (
          <ul className="adm-bulk-report__list">
            {issues.map((issue) => (
              <li key={`${issue.kind}-${issue.id}`} className="adm-bulk-report__item">
                {itemHref ? <a href={itemHref(issue.id)}>{itemLabel(issue.id)}</a> : <strong>{itemLabel(issue.id)}</strong>}
                <span>{issue.reason}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="adm-row-actions">
          {outcome.interrupted && onContinue ? (
            <button type="button" className="adm-btn adm-btn--primary" onClick={onContinue}>
              Continue
            </button>
          ) : null}
          {onRetry && retry.length > 0 ? (
            <button
              type="button"
              className="adm-btn adm-btn--primary"
              onClick={() => onRetry(retry.map((r) => r.id))}
            >
              Retry the {retry.length} that failed
            </button>
          ) : null}
          {issues.length > 0 ? (
            <button
              type="button"
              className="adm-btn adm-btn--secondary"
              onClick={() => void navigator.clipboard?.writeText(reportText(outcome, itemLabel))}
            >
              Copy list
            </button>
          ) : null}
          <button type="button" className="adm-btn adm-btn--ghost" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </Banner>
  );
}
