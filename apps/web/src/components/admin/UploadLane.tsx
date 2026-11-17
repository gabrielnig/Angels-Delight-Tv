'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { formatBytes, formatEta, formatSpeed } from '@/lib/uploader/format';
import type { Lane } from '@/lib/uploader/types';
import { Badge } from './Badge';
import { Button } from './Button';
import { Icon } from './Icon';
import { PosterTile, seedOf } from './PosterTile';
import { ProgressBar } from './ProgressBar';

export interface LaneActions {
  pause(id: string): void;
  resume(id: string): void;
  retry(id: string): void;
  cancel(id: string): void;
  remove(id: string): void;
  replace(id: string, file: File): void;
}

/** One line of status text per state (DESIGN-SYSTEM 11.17). */
export function laneStatusText(lane: Lane): string {
  switch (lane.status) {
    case 'waiting':
      return 'Waiting';
    case 'uploading':
      return `${lane.percent} percent, ${formatSpeed(lane.speedBytesPerSecond)}, ${formatEta(lane.etaSeconds).toLowerCase()}`;
    case 'paused':
      return `Paused at ${lane.percent} percent`;
    case 'offline':
      return 'Waiting for network. It will continue by itself.';
    case 'processing':
      return 'Preparing your video';
    case 'done':
      return 'Uploaded just now';
    case 'failed':
    case 'rejected':
      return lane.message ?? 'Upload failed.';
  }
}

/** Ten percent steps for screen readers, so progress is not read on every tick. */
export function announcement(lane: Lane): string {
  if (lane.status === 'uploading')
    return `${lane.name}: ${Math.floor(lane.percent / 10) * 10} percent uploaded`;
  if (lane.status === 'failed') return `${lane.name}: ${lane.message ?? 'upload failed'}`;
  if (lane.status === 'done') return `${lane.name}: upload finished`;
  if (lane.status === 'paused') return `${lane.name}: paused`;
  if (lane.status === 'offline') return `${lane.name}: waiting for network`;
  return '';
}

export function UploadLane({
  lane,
  actions,
  videoId,
}: {
  lane: Lane;
  actions: LaneActions;
  videoId?: string;
}) {
  const replaceInput = useRef<HTMLInputElement>(null);
  const tone =
    lane.status === 'failed'
      ? 'danger'
      : lane.status === 'paused' || lane.status === 'offline'
        ? 'paused'
        : lane.status === 'done'
          ? 'success'
          : 'primary';
  const text = laneStatusText(lane);
  const step = Math.floor(lane.percent / 10) * 10;

  if (lane.status === 'done') {
    return (
      <li className="adm-lane adm-lane--done">
        <PosterTile title={lane.name} seed={seedOf(lane.name)} size="md" />
        <div className="adm-lane__main">
          <p className="adm-lane__name" title={lane.name}>
            {lane.name}
          </p>
          <p className="adm-muted">
            {lane.type || 'video/mp4'} , {formatBytes(lane.size)} (
            {lane.size.toLocaleString('en-NG')} bytes)
          </p>
          <Badge tone="success" icon="check">
            {text}
          </Badge>
        </div>
        <div className="adm-lane__actions">
          <Link
            className="adm-btn adm-btn--primary"
            href={videoId ? `/admin/videos/${videoId}` : '/admin/videos'}
            aria-label={`Edit details for ${lane.name}`}
          >
            Edit details
          </Link>
          <input
            ref={replaceInput}
            type="file"
            hidden
            accept=".mp4,.mov,.mkv,video/mp4,video/quicktime,video/x-matroska"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) actions.replace(lane.id, file);
              e.target.value = '';
            }}
          />
          <Button onClick={() => replaceInput.current?.click()} aria-label={`Replace ${lane.name}`}>
            Replace
          </Button>
          <Button
            variant="ghost"
            onClick={() => actions.remove(lane.id)}
            aria-label={`Remove ${lane.name}`}
          >
            Remove
          </Button>
        </div>
      </li>
    );
  }

  if (lane.status === 'rejected') {
    return (
      <li className="adm-lane adm-lane--rejected">
        <Icon name="alert" />
        <p className="adm-lane__main" role="alert">
          {lane.message}
        </p>
        <Button
          variant="ghost"
          onClick={() => actions.remove(lane.id)}
          aria-label={`Dismiss ${lane.name}`}
        >
          Dismiss
        </Button>
      </li>
    );
  }

  return (
    <li className="adm-lane" data-status={lane.status}>
      <PosterTile title={lane.name} seed={seedOf(lane.name)} />
      <div className="adm-lane__main">
        <p className="adm-lane__name" title={lane.name}>
          {lane.name} <span className="adm-muted">{formatBytes(lane.size)}</span>
        </p>
        <ProgressBar
          value={lane.percent}
          tone={tone}
          label={`Upload of ${lane.name}`}
          indeterminate={lane.status === 'processing'}
        />
        <p
          className={
            lane.status === 'failed'
              ? 'adm-lane__text adm-field__error'
              : 'adm-lane__text adm-muted'
          }
        >
          {text}
        </p>
        <span className="adm-sr" aria-live="polite" data-step={step}>
          {announcement(lane)}
        </span>
      </div>
      <div className="adm-lane__actions">
        {lane.status === 'uploading' ? (
          <Button
            onClick={() => actions.pause(lane.id)}
            icon="pause"
            aria-label={`Pause ${lane.name}`}
          >
            Pause
          </Button>
        ) : null}
        {lane.status === 'paused' ? (
          <Button
            variant="primary"
            onClick={() => actions.resume(lane.id)}
            icon="play"
            aria-label={`Resume ${lane.name}`}
          >
            Resume
          </Button>
        ) : null}
        {lane.status === 'failed' ? (
          <Button
            variant="primary"
            onClick={() => actions.retry(lane.id)}
            icon="retry"
            aria-label={`Retry ${lane.name}`}
          >
            Retry
          </Button>
        ) : null}
        {lane.status === 'offline' ? (
          <Button
            onClick={() => actions.retry(lane.id)}
            icon="retry"
            aria-label={`Try now ${lane.name}`}
          >
            Try now
          </Button>
        ) : null}
        {lane.status !== 'processing' ? (
          <Button
            variant="ghost"
            aria-label={`${lane.status === 'failed' ? 'Remove' : 'Cancel'} ${lane.name}`}
            onClick={() => actions.cancel(lane.id)}
          >
            {lane.status === 'failed' ? 'Remove' : 'Cancel'}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
