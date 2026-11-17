'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatRelative } from '@/lib/admin/format';
import type { VideoRecord } from '@/lib/data/admin/types';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { Badge } from './Badge';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';
import { Banner, EmptyState } from './states';
import { useToast } from './Toast';

const POLL_MS = 5000;

function stageOf(video: VideoRecord): string {
  if (video.status === 'failed') return video.failure?.stage ?? 'Encoding';
  if (video.status === 'validating') return 'Checking the file';
  if (video.status === 'uploaded') return 'Waiting to start';
  return video.progress < 20 ? 'Checking the file' : video.progress < 90 ? 'Making streaming sizes' : 'Final checks';
}

/** Live queue. Refreshes every 5 seconds while the tab is visible and online (DESIGN-SYSTEM 11.17). */
export function EncodingQueue({ jobs, now, retry }: { jobs: VideoRecord[]; now: number; retry: (id: string) => Promise<CommandResult> }) {
  const router = useRouter();
  const toast = useToast();
  const [paused, setPaused] = useState(false);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

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
      toast.show(result.ok ? { tone: 'success', message: `${video.title} is back in the queue.` } : { tone: 'danger', message: result.error });
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
        <Banner tone="warning" action={paused ? <Button onClick={() => setPaused(false)}>Resume updates</Button> : undefined}>
          {offline ? 'Live updates paused. You are offline.' : 'Live updates paused.'}
        </Banner>
      ) : (
        <div className="adm-row adm-muted">
          <span role="status">Updating live</span>
          <Button variant="ghost" onClick={() => setPaused(true)}>Pause updates</Button>
        </div>
      )}
      {jobs.length === 0 ? (
        <div className="adm-card"><EmptyState title="Nothing is encoding." help="New uploads show up here while they are prepared." icon="encoding" /></div>
      ) : (
        <ul className="adm-card adm-list" aria-label="Encoding jobs">
          {jobs.map((video) => (
            <li key={video.id} style={{ alignItems: 'flex-start' }}>
              <div className="adm-list__main" style={{ display: 'grid', gap: 'var(--space-2)' }}>
                <Link className="adm-list__title" href={`/admin/videos/${video.id}`}>{video.title}</Link>
                <p className="adm-list__sub">{stageOf(video)} , updated {formatRelative(video.updatedAt, now)}</p>
                {video.status === 'failed' ? (
                  <Banner tone="danger">
                    <strong>It did not finish.</strong> {video.failure?.reason} The original file is safe. Retry, or upload the file again if it keeps failing.
                  </Banner>
                ) : (
                  <ProgressBar label={`Encoding ${video.title}`} value={video.progress} />
                )}
              </div>
              <div className="adm-row">
                {video.status === 'failed' ? <Badge tone="danger" icon="alert">Failed</Badge> : <Badge tone="info" icon="clock">Processing</Badge>}
                {video.status === 'failed' ? (
                  <Button variant="primary" icon="retry" loading={busy === video.id} aria-label={`Retry encoding ${video.title}`} onClick={() => onRetry(video)}>
                    Retry
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
