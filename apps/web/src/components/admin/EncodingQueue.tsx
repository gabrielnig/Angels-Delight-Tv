'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatRelative } from '@/lib/admin/format';
import { describeOutcome, mergeOutcomes, newBulkId, type BulkOutcome } from '@/lib/data/admin/bulk';
import type { VideoRecord } from '@/lib/data/admin/types';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { Badge } from './Badge';
import { BulkBar } from './bulk/BulkBar';
import { BulkReport } from './bulk/BulkReport';
import { useBulkRun } from './bulk/useBulkRun';
import { useSelection } from './bulk/useSelection';
import { Button } from './Button';
import { ConfirmDialog } from './Dialog';
import { Checkbox } from './fields';
import { ProgressBar } from './ProgressBar';
import { Banner, EmptyState } from './states';
import { useToast } from './Toast';

const POLL_MS = 5000;

function stageOf(video: VideoRecord): string {
  if (video.status === 'failed') return video.failure?.stage ?? 'Encoding';
  if (video.status === 'validating') return 'Checking the file';
  if (video.status === 'uploaded') return 'Waiting to start';
  return video.progress < 20
    ? 'Checking the file'
    : video.progress < 90
      ? 'Making streaming sizes'
      : 'Final checks';
}

/** Live queue. Refreshes every 5 seconds while the tab is visible and online (DESIGN-SYSTEM 11.17). */
export function EncodingQueue({
  jobs,
  now,
  retry,
  retryMany,
}: {
  jobs: VideoRecord[];
  now: number;
  retry: (id: string) => Promise<CommandResult>;
  retryMany: (ids: string[], bulkId: string) => Promise<BulkOutcome>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [paused, setPaused] = useState(false);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const failedIds = useMemo(() => jobs.filter((j) => j.status === 'failed').map((j) => j.id), [jobs]);
  const sel = useSelection(failedIds);
  const [confirm, setConfirm] = useState(false);
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  const runner = useBulkRun(useCallback((chunk, bulkId) => retryMany(chunk, bulkId), [retryMany]));
  const titleOf = (id: string) => jobs.find((j) => j.id === id)?.title ?? id;

  async function retrySelected(ids: string[], prior?: BulkOutcome) {
    setConfirm(false);
    const result = await runner.start(ids, prior?.bulkId ?? newBulkId());
    const merged = prior ? mergeOutcomes(prior, result) : result;
    if (merged.interrupted && merged.succeeded.length === 0 && merged.failed.length === 0) {
      toast.show({ tone: 'danger', message: 'Retry did not work. Nothing was changed. Try again.' });
      return;
    }
    setOutcome(merged);
    sel.clear();
    if (merged.succeeded.length > 0)
      toast.show({
        tone: 'success',
        message: `${merged.succeeded.length} ${merged.succeeded.length === 1 ? 'is' : 'are'} back in the queue.`,
      });
    router.refresh();
  }

  useEffect(() => {
    if (paused) return;
    const tick = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) router.refresh();
    };
    const timer = setInterval(tick, POLL_MS);
    return () => clearInterval(timer);
  }, [paused, router]);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  async function onRetry(video: VideoRecord) {
    setBusy(video.id);
    try {
      const result = await retry(video.id);
      toast.show(
        result.ok
          ? { tone: 'success', message: `${video.title} is back in the queue.` }
          : { tone: 'danger', message: result.error },
      );
      router.refresh();
    } catch {
      toast.show({ tone: 'danger', message: 'Could not retry. Try again in a moment.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="adm-stack">
      {paused || offline ? (
        <Banner
          tone="warning"
          action={
            paused ? <Button onClick={() => setPaused(false)}>Resume updates</Button> : undefined
          }
        >
          {offline ? 'Live updates paused. You are offline.' : 'Live updates paused.'}
        </Banner>
      ) : (
        <div className="adm-row adm-muted">
          <span role="status">Updating live</span>
          <Button variant="ghost" onClick={() => setPaused(true)}>
            Pause updates
          </Button>
        </div>
      )}
      {outcome ? (
        <BulkReport
          label="Retry"
          outcome={outcome}
          itemLabel={titleOf}
          itemHref={(id) => `/admin/videos/${id}`}
          onDismiss={() => setOutcome(null)}
          onRetry={(ids) => void retrySelected(ids, outcome)}
        />
      ) : null}
      {sel.count > 0 ? (
        <BulkBar
          count={sel.count}
          onClear={sel.clear}
          actions={[
            {
              id: 'retry',
              label: `Retry ${sel.count} failed`,
              variant: 'primary',
              onClick: () => setConfirm(true),
            },
          ]}
        />
      ) : null}
      {jobs.length === 0 ? (
        <div className="adm-card">
          <EmptyState
            title="Nothing is encoding."
            help="New uploads show up here while they are prepared."
            icon="encoding"
          />
        </div>
      ) : (
        <ul className="adm-card adm-list" aria-label="Encoding jobs">
          {jobs.map((video) => (
            <li key={video.id} style={{ alignItems: 'flex-start' }}>
              {video.status === 'failed' ? (
                <Checkbox
                  label={`Select ${video.title}`}
                  checked={sel.isSelected(video.id)}
                  onChange={() => sel.toggle(video.id)}
                />
              ) : (
                <span className="adm-select-spacer" aria-hidden="true" />
              )}
              <div className="adm-list__main" style={{ display: 'grid', gap: 'var(--space-2)' }}>
                <Link className="adm-list__title" href={`/admin/videos/${video.id}`}>
                  {video.title}
                </Link>
                <p className="adm-list__sub">
                  {stageOf(video)} , updated {formatRelative(video.updatedAt, now)}
                </p>
                {video.status === 'failed' ? (
                  <Banner tone="danger">
                    <strong>It did not finish.</strong> {video.failure?.reason} The original file is
                    safe. Retry, or upload the file again if it keeps failing.
                  </Banner>
                ) : (
                  <ProgressBar label={`Encoding ${video.title}`} value={video.progress} />
                )}
              </div>
              <div className="adm-row">
                {video.status === 'failed' ? (
                  <Badge tone="danger" icon="alert">
                    Failed
                  </Badge>
                ) : (
                  <Badge tone="info" icon="clock">
                    Processing
                  </Badge>
                )}
                {video.status === 'failed' ? (
                  <Button
                    variant="primary"
                    icon="retry"
                    loading={busy === video.id}
                    aria-label={`Retry encoding ${video.title}`}
                    onClick={() => onRetry(video)}
                  >
                    Retry
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={confirm}
        title={`Retry ${sel.count} ${sel.count === 1 ? 'encode' : 'encodes'}?`}
        consequence="They are queued oldest failure first and run one after another, so the last one can take a while."
        confirmLabel={`Retry ${sel.count}`}
        busy={runner.running}
        onClose={() => setConfirm(false)}
        onConfirm={() => void retrySelected([...sel.selected])}
      />
    </div>
  );
}
