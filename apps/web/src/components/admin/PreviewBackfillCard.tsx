'use client';

import { useState } from 'react';
import type { PreviewBackfillOutcome } from '@/lib/data/admin/video-commands';
import { Button } from './Button';
import { Card } from './PageHeader';

const plural = (n: number) => `${n} video${n === 1 ? '' : 's'}`;

/** Cuts hero clips for the videos that were published before the feature existed, or whose clip is out of date (D-355). */
export function PreviewBackfillCard({
  canRun,
  onRun,
}: {
  /** Admins only (preview.backfill). */
  canRun: boolean;
  onRun(): Promise<PreviewBackfillOutcome>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  async function run() {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const result = await onRun();
      if (!result.ok) setError(result.error);
      else if (result.queued === 0)
        setMessage(`Nothing to queue. ${plural(result.current)} already have a current clip.`);
      else
        setMessage(
          `Queued ${plural(result.queued)}. ${result.current} already have a current clip. Clips show on Home as each one finishes, about a minute each. Press it again any time, it never queues a video twice.`,
        );
    } catch {
      setError('That did not work. Nothing was queued. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Hero clips">
      <div className="adm-stack">
        <p className="adm-muted" style={{ margin: 0 }}>
          Makes the short clip, with sound, for every published video that has none or an out of date one. Videos
          you set to Off are left alone. Use it after you change the clip length.
        </p>
        <div className="adm-row">
          <Button variant="primary" disabled={!canRun || busy} loading={busy} onClick={() => void run()}>
            Generate previews for all videos
          </Button>
          {!canRun ? <span className="adm-muted">Only admins can do this.</span> : null}
        </div>
        {message ? (
          <p role="status" style={{ margin: 0 }}>
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="adm-field__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
