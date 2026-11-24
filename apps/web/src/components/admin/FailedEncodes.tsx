'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { AccountRole } from '@ad/shared';
import { formatRelative } from '@/lib/admin/format';
import { describeOutcome, mergeOutcomes, newBulkId, type BulkOutcome } from '@/lib/data/admin/bulk';
import type { CleanupResult, FailedEncodeRecord } from '@/lib/data/admin/types';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { formatBytes } from '@/lib/uploader/format';
import { Badge } from './Badge';
import { BulkBar } from './bulk/BulkBar';
import { BulkReport } from './bulk/BulkReport';
import { useBulkRun } from './bulk/useBulkRun';
import { useSelection } from './bulk/useSelection';
import { Button, LinkButton } from './Button';
import { Checkbox } from './fields';
import { ConfirmDialog } from './Dialog';
import { EmptyState } from './states';
import { useToast } from './Toast';

type Pending =
  | { kind: 'one'; row: FailedEncodeRecord }
  | { kind: 'all' }
  | { kind: 'retry' }
  | { kind: 'cleanup' }
  | null;

/**
 * Failed encodes and what they left behind (M14-S06, M14-S09). Retry starts the job again. Clean up removes
 * partial output only: the original file and the captions are never touched.
 */
export function FailedEncodes({
  rows,
  role: _role,
  now,
  retry,
  cleanup,
  cleanupAll,
  retryMany,
  cleanupMany,
}: {
  rows: FailedEncodeRecord[];
  role: AccountRole;
  now: number;
  retry: (id: string) => Promise<CommandResult>;
  cleanup: (id: string) => Promise<CleanupResult>;
  cleanupAll: () => Promise<CleanupResult>;
  retryMany: (ids: string[], bulkId: string) => Promise<BulkOutcome>;
  cleanupMany: (ids: string[], bulkId: string) => Promise<BulkOutcome>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  const ids = useMemo(() => rows.map((r) => r.videoId), [rows]);
  const sel = useSelection(ids);
  const modeRef = useRef<'retry' | 'cleanup'>('retry');
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  const runner = useBulkRun(
    useCallback(
      (chunk, bulkId) => (modeRef.current === 'retry' ? retryMany : cleanupMany)(chunk, bulkId),
      [retryMany, cleanupMany],
    ),
  );
  const chosen = rows.filter((r) => sel.isSelected(r.videoId));
  const retryable = chosen.filter((r) => r.canRetry);
  const leftover = chosen.filter((r) => r.leftoverFiles > 0);
  const titleOf = (id: string) => rows.find((r) => r.videoId === id)?.title ?? id;

  async function runBulk(mode: 'retry' | 'cleanup', list: string[], prior?: BulkOutcome) {
    modeRef.current = mode;
    setPending(null);
    const result = await runner.start(list, prior?.bulkId ?? newBulkId());
    const merged = prior ? mergeOutcomes(prior, result) : result;
    if (merged.interrupted && merged.succeeded.length === 0 && merged.failed.length === 0) {
      toast.show({ tone: 'danger', message: 'That did not work. Nothing was changed. Try again.' });
      return;
    }
    setOutcome(merged);
    sel.clear();
    if (merged.succeeded.length > 0)
      toast.show({
        tone: 'success',
        message: describeOutcome(mode === 'retry' ? 'Retry' : 'Clean up', merged),
      });
    router.refresh();
  }

  const dirty = rows.filter((r) => r.leftoverFiles > 0);
  const dirtyBytes = dirty.reduce((n, r) => n + r.leftoverBytes, 0);

  async function run<R extends { ok: true } | { ok: false; error: string }>(
    id: string,
    work: () => Promise<R>,
    done: (result: Extract<R, { ok: true }>) => string,
  ) {
    setBusy(id);
    try {
      const result = await work();
      toast.show(
        result.ok
          ? { tone: 'success', message: done(result as Extract<R, { ok: true }>) }
          : { tone: 'danger', message: result.error },
      );
      router.refresh();
    } catch {
      toast.show({ tone: 'danger', message: 'That did not work. Nothing was changed. Try again.' });
    } finally {
      setBusy(null);
      setPending(null);
    }
  }

  const summary = (r: { removedFiles: number; freedBytes: number }) =>
    r.removedFiles === 0
      ? 'Nothing was left to clean up.'
      : `Removed ${r.removedFiles} files and freed ${formatBytes(r.freedBytes)}.`;

  if (rows.length === 0) {
    return (
      <div className="adm-card">
        <EmptyState
          title="No failed encodes."
          help="When a video cannot be prepared for streaming it shows up here."
          icon="encoding"
          action={<LinkButton href="/admin/encoding">Back to the encoding queue</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div className="adm-stack">
      <div className="adm-row" style={{ justifyContent: 'space-between' }}>
        <p className="adm-muted" style={{ margin: 0 }}>
          {rows.length} failed. {dirty.length > 0 ? `${formatBytes(dirtyBytes)} of leftover files.` : 'No leftover files.'}
        </p>
        <Button
          variant="secondary"
          icon="trash"
          disabledReason={dirty.length === 0 ? 'There are no leftover files.' : undefined}
          onClick={() => setPending({ kind: 'all' })}
        >
          Clean up all
        </Button>
      </div>

      {outcome ? (
        <BulkReport
          label={modeRef.current === 'retry' ? 'Retry' : 'Clean up'}
          outcome={outcome}
          itemLabel={titleOf}
          itemHref={(id) => `/admin/videos/${id}`}
          onDismiss={() => setOutcome(null)}
          onRetry={(list) => void runBulk(modeRef.current, list, outcome)}
        />
      ) : null}
      {sel.count > 0 ? (
        <BulkBar
          count={sel.count}
          onClear={sel.clear}
          note={
            chosen.length > retryable.length
              ? `${chosen.length - retryable.length} cannot be retried`
              : undefined
          }
          actions={[
            {
              id: 'retry',
              label: `Retry ${retryable.length}`,
              variant: 'primary',
              onClick: () => setPending({ kind: 'retry' }),
              disabledReason: retryable.length === 0 ? 'None of these can be retried.' : undefined,
            },
            {
              id: 'cleanup',
              label: `Clean up ${leftover.length}`,
              onClick: () => setPending({ kind: 'cleanup' }),
              disabledReason: leftover.length === 0 ? 'There are no leftover files here.' : undefined,
            },
          ]}
        />
      ) : null}
      <ul className="adm-card adm-list" aria-label="Failed encodes">
        {rows.map((row) => (
          <li key={row.videoId} style={{ alignItems: 'flex-start' }}>
            <Checkbox
              label={`Select ${row.title}`}
              checked={sel.isSelected(row.videoId)}
              onChange={() => sel.toggle(row.videoId)}
            />
            <div className="adm-list__main" style={{ display: 'grid', gap: 'var(--space-2)' }}>
              <Link className="adm-list__title" href={`/admin/videos/${row.videoId}`}>
                {row.title}
              </Link>
              <p className="adm-list__sub">
                Failed {formatRelative(row.failedAt, now)}
                {row.stage ? `, while ${row.stage.toLowerCase()}` : ''}. Tried {row.attempts} times.
              </p>
              <p style={{ margin: 0 }}>{row.plain}</p>
              {row.hasOriginal ? (
                <p className="adm-list__sub">
                  Original file kept{row.originalBytes ? ` (${formatBytes(row.originalBytes)})` : ''}.
                </p>
              ) : (
                <p className="adm-list__sub">
                  The original file was removed, so this cannot be retried. Replace the file instead.
                </p>
              )}
              <p className="adm-list__sub">
                {row.leftoverFiles > 0
                  ? `${row.leftoverFiles} leftover files (${formatBytes(row.leftoverBytes)})`
                  : 'No leftover files'}
              </p>
              {row.technical ? (
                <details>
                  <summary>Technical detail</summary>
                  <pre className="adm-detail">{row.technical}</pre>
                </details>
              ) : null}
            </div>
            <div className="adm-row">
              <Badge tone="danger" icon="alert">
                Failed
              </Badge>
              {row.canRetry ? (
                <Button
                  variant="primary"
                  icon="retry"
                  loading={busy === row.videoId}
                  aria-label={`Retry ${row.title}`}
                  onClick={() =>
                    run(row.videoId, () => retry(row.videoId), () => `${row.title} is back in the queue.`)
                  }
                >
                  Retry
                </Button>
              ) : null}
              {row.leftoverFiles > 0 ? (
                <Button aria-label={`Clean up ${row.title}`} onClick={() => setPending({ kind: 'one', row })}>
                  Clean up
                </Button>
              ) : null}
              <LinkButton
                href={`/admin/videos/upload?replace=${row.videoId}`}
                variant="ghost"
                aria-label={`Replace file for ${row.title}`}
              >
                Replace file
              </LinkButton>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pending?.kind === 'one'}
        title={`Clean up ${pending?.kind === 'one' ? pending.row.title : ''}?`}
        consequence="The partly made streaming files are deleted so a retry starts fresh. The original video file is not touched."
        confirmLabel="Clean up"
        busy={busy !== null}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending?.kind !== 'one') return;
          const { row } = pending;
          void run(row.videoId, () => cleanup(row.videoId), summary);
        }}
      />
      <ConfirmDialog
        open={pending?.kind === 'retry'}
        title={`Retry ${retryable.length} ${retryable.length === 1 ? 'encode' : 'encodes'}?`}
        consequence="They are queued oldest failure first and run one after another, so the last one can take a while."
        confirmLabel={`Retry ${retryable.length}`}
        busy={runner.running}
        onClose={() => setPending(null)}
        onConfirm={() => void runBulk('retry', retryable.map((r) => r.videoId))}
      />
      <ConfirmDialog
        open={pending?.kind === 'cleanup'}
        title={`Clean up ${leftover.length} ${leftover.length === 1 ? 'video' : 'videos'}?`}
        consequence="The partly made streaming files are deleted so a retry starts fresh. Original video files are not touched."
        confirmLabel={`Clean up ${leftover.length}`}
        busy={runner.running}
        onClose={() => setPending(null)}
        onConfirm={() => void runBulk('cleanup', leftover.map((r) => r.videoId))}
      />
      <ConfirmDialog
        open={pending?.kind === 'all'}
        title="Clean up all failed encodes?"
        consequence={`Partly made streaming files of ${dirty.length} videos (${formatBytes(dirtyBytes)}) are deleted. Original video files are not touched.`}
        confirmLabel="Clean up all"
        busy={busy !== null}
        onClose={() => setPending(null)}
        onConfirm={() => void run('all', cleanupAll, summary)}
      />
    </div>
  );
}
