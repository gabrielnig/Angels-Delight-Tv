'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { AccountRole } from '@ad/shared';
import { can } from '@/lib/admin/can';
import { formatRelative } from '@/lib/admin/format';
import { planBulkApprove } from '@/lib/data/admin/caption-commands';
import {
  describeOutcome,
  mergeOutcomes,
  newBulkId,
  type BulkOutcome,
} from '@/lib/data/admin/bulk';
import type { CaptionRow } from '@/lib/data/admin/services';
import { CaptionBadge } from './Badge';
import { BulkBar, type BulkBarAction } from './bulk/BulkBar';
import { BulkProgress } from './bulk/BulkProgress';
import { BulkReport } from './bulk/BulkReport';
import { useBulkRun } from './bulk/useBulkRun';
import { useSelection } from './bulk/useSelection';
import { LinkButton } from './Button';
import { ConfirmDialog } from './Dialog';
import { Checkbox } from './fields';
import { useToast } from './Toast';

export type ApproveManyAction = (ids: string[], bulkId: string) => Promise<BulkOutcome>;

const actionWord = (state: CaptionRow['state']) =>
  state === 'needs_review'
    ? 'Review'
    : state === 'approved'
      ? 'Open'
      : state === 'failed'
        ? 'Retry'
        : state === 'none'
          ? 'Generate'
          : 'View';

/** The Captions list with selection and bulk approve (M42-S07). Approve has no Undo: approval is a review. */
export function CaptionTable({
  rows,
  role,
  approve,
  now,
}: {
  rows: CaptionRow[];
  role: AccountRole;
  approve: ApproveManyAction;
  now: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const tableRef = useRef<HTMLDivElement>(null);
  const ids = useMemo(() => rows.map((r) => r.videoId), [rows]);
  const sel = useSelection(ids);
  const [confirm, setConfirm] = useState(false);
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  const [lastIds, setLastIds] = useState<string[]>([]);
  const runner = useBulkRun(useCallback((chunk, bulkId) => approve(chunk, bulkId), [approve]));
  const allowed = can(role, 'caption.approve_bulk');

  const chosen = rows.filter((r) => sel.isSelected(r.videoId));
  const plan = planBulkApprove(
    chosen.map((r) => ({
      videoId: r.videoId,
      state: r.state,
      warnings: r.warnings,
      untouchedAuto: r.untouchedAuto,
    })),
  );
  const titleOf = (id: string) => rows.find((r) => r.videoId === id)?.title ?? id;

  async function run(idsToRun: string[], prior?: BulkOutcome, skipped = plan.skipped) {
    setConfirm(false);
    setLastIds(idsToRun);
    const result = await runner.start(idsToRun, prior?.bulkId ?? newBulkId());
    const merged = prior ? mergeOutcomes(prior, result) : result;
    const withSkips = { ...merged, skipped: [...merged.skipped, ...(prior ? [] : skipped)] };
    const nothingHappened =
      withSkips.interrupted !== undefined &&
      withSkips.succeeded.length === 0 &&
      withSkips.failed.length === 0;
    if (nothingHappened) {
      toast.show({ tone: 'danger', message: 'Approve did not work. Nothing was changed. Try again.' });
      return;
    }
    setOutcome(withSkips);
    sel.clear();
    if (withSkips.succeeded.length > 0)
      toast.show({ tone: 'success', message: describeOutcome('Approve', withSkips) });
    router.refresh();
  }

  const actions: BulkBarAction[] = [
    {
      id: 'approve',
      label: `Approve ${plan.eligible.length}`,
      variant: 'primary',
      onClick: () => setConfirm(true),
      disabledReason: !allowed
        ? 'Only an admin can approve captions in bulk.'
        : plan.eligible.length === 0
          ? 'Nothing selected can be approved yet.'
          : undefined,
    },
  ];
  const untouched = plan.untouchedAuto.length;

  return (
    <>
      {runner.running && (runner.progress?.total ?? 0) > 25 ? (
        <BulkProgress
          label="Approve"
          done={runner.progress?.done ?? 0}
          total={runner.progress?.total ?? 0}
          offline={runner.offline}
          onCancel={runner.cancel}
        />
      ) : null}
      {outcome ? (
        <BulkReport
          label="Approve"
          outcome={outcome}
          itemLabel={titleOf}
          itemHref={(id) => `/admin/captions/${id}`}
          onDismiss={() => setOutcome(null)}
          onRetry={(retryIds) => void run(retryIds, outcome)}
          onContinue={() =>
            void run(lastIds.slice(outcome.interrupted?.done ?? 0), {
              ...outcome,
              interrupted: undefined,
            })
          }
        />
      ) : null}
      {sel.count > 0 ? (
        <BulkBar
          count={sel.count}
          onClear={sel.clear}
          actions={actions}
          note={plan.skipped.length > 0 ? `${plan.skipped.length} will be skipped` : undefined}
          returnFocusTo={() => tableRef.current}
        />
      ) : null}
      <div className="adm-card adm-table-card" ref={tableRef} tabIndex={-1}>
        <table className="adm-table">
          <caption className="adm-sr">Videos and their captions</caption>
          <thead>
            <tr>
              <th scope="col" className="adm-table__check">
                <Checkbox
                  label="Select all on this page"
                  checked={sel.allOnPage}
                  onChange={sel.togglePage}
                />
              </th>
              <th scope="col">Video</th>
              <th scope="col">State</th>
              <th scope="col">Language</th>
              <th scope="col" className="adm-num">
                Cues
              </th>
              <th scope="col">Last edited</th>
              <th scope="col">
                <span className="adm-sr">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.videoId} className={sel.isSelected(row.videoId) ? 'is-selected' : undefined}>
                <td className="adm-table__check">
                  <Checkbox
                    label={`Select ${row.title}`}
                    checked={sel.isSelected(row.videoId)}
                    onChange={() => sel.toggle(row.videoId)}
                  />
                </td>
                <td>
                  <Link className="adm-vtitle" href={`/admin/captions/${row.videoId}`}>
                    {row.title}
                  </Link>
                </td>
                <td>
                  <CaptionBadge state={row.state} />
                </td>
                <td>{row.language}</td>
                <td className="adm-num">
                  {row.cueCount ?? (row.state === 'generating' ? 'Working' : 'None')}
                </td>
                <td>
                  {row.lastEditedAt
                    ? `${row.lastEditedBy}, ${formatRelative(row.lastEditedAt, now)}`
                    : row.lastEditedBy}
                </td>
                <td>
                  <LinkButton
                    href={`/admin/captions/${row.videoId}`}
                    variant={row.state === 'needs_review' ? 'primary' : 'secondary'}
                    aria-label={`${actionWord(row.state)} captions for ${row.title}`}
                  >
                    {actionWord(row.state)}
                  </LinkButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="adm-cards" aria-label="Videos and their captions">
          {rows.map((row) => (
            <li
              key={row.videoId}
              className={`adm-vcard adm-vcard--plain${sel.isSelected(row.videoId) ? ' is-selected' : ''}`}
            >
              <Checkbox
                label={`Select ${row.title}`}
                checked={sel.isSelected(row.videoId)}
                onChange={() => sel.toggle(row.videoId)}
              />
              <div className="adm-vcard__body">
                <Link className="adm-vtitle" href={`/admin/captions/${row.videoId}`}>
                  {row.title}
                </Link>
                <div className="adm-row">
                  <CaptionBadge state={row.state} />
                  <span className="adm-muted">
                    {row.cueCount ?? (row.state === 'generating' ? 'Working' : 'None')} cues
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <ConfirmDialog
        open={confirm}
        title={`Approve ${plan.eligible.length} ${plan.eligible.length === 1 ? 'caption' : 'captions'}?`}
        consequence="Approved captions can be published. Anything with warnings is left for you to review."
        confirmLabel={`Approve ${plan.eligible.length}`}
        busy={runner.running}
        acknowledge={
          untouched > 0
            ? `I know ${untouched} of these are automatic captions nobody has opened.`
            : undefined
        }
        onClose={() => setConfirm(false)}
        onConfirm={() => void run(plan.eligible)}
      >
        <p>
          {plan.eligible.length} will be approved.
          {plan.skipped.length > 0 ? ` ${plan.skipped.length} will be skipped.` : ''}
        </p>
        {untouched > 0 ? (
          <p>
            <Link href="/admin/captions?edited=never">Show those {untouched} first</Link>
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
