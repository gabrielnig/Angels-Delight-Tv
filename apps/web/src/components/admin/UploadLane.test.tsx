// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Lane } from '@/lib/uploader/types';
import { UploadLane, laneStatusText } from './UploadLane';

const MIB = 1024 * 1024;
const lane = (over: Partial<Lane> = {}): Lane => ({
  id: 'l1',
  name: 'lesson one.mp4',
  size: 100 * MIB,
  type: 'video/mp4',
  fingerprint: 'f',
  status: 'uploading',
  bytesUploaded: 62 * MIB,
  percent: 62,
  speedBytesPerSecond: 8.4 * MIB,
  etaSeconds: 120,
  attempt: 1,
  ...over,
});
const actions = () => ({
  pause: vi.fn(),
  resume: vi.fn(),
  retry: vi.fn(),
  cancel: vi.fn(),
  remove: vi.fn(),
  replace: vi.fn(),
});

describe('UploadLane', () => {
  it('shows honest progress text and a numbered progress bar', () => {
    render(
      <ul>
        <UploadLane lane={lane()} actions={actions()} />
      </ul>,
    );
    expect(screen.getByText('62 percent, 8.4 MB/s, about 2 min left')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Upload of lesson one.mp4' });
    expect(bar).toHaveAttribute('aria-valuenow', '62');
  });

  it('names the file in every action so they are distinct for screen readers', async () => {
    const a = actions();
    render(
      <ul>
        <UploadLane lane={lane()} actions={a} />
      </ul>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Pause lesson one.mp4' }));
    expect(a.pause).toHaveBeenCalledWith('l1');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel lesson one.mp4' }));
    expect(a.cancel).toHaveBeenCalledWith('l1');
  });

  it('a failed lane says how much was saved and offers Retry', async () => {
    const a = actions();
    render(
      <ul>
        <UploadLane
          lane={lane({
            status: 'failed',
            percent: 90,
            message: 'Upload failed. 90 percent was saved.',
          })}
          actions={a}
        />
      </ul>,
    );
    expect(screen.getByText('Upload failed. 90 percent was saved.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry lesson one.mp4' }));
    expect(a.retry).toHaveBeenCalledWith('l1');
  });

  it('a paused lane can resume and an offline lane explains itself', () => {
    expect(laneStatusText(lane({ status: 'paused' }))).toBe('Paused at 62 percent');
    expect(laneStatusText(lane({ status: 'offline' }))).toBe(
      'Waiting for network. It will continue by itself.',
    );
    expect(laneStatusText(lane({ status: 'processing' }))).toBe('Preparing your video');
  });

  it('a done lane becomes a preview card with exact size, Replace, Remove and Edit details', () => {
    render(
      <ul>
        <UploadLane
          lane={lane({ status: 'done', percent: 100 })}
          actions={actions()}
          videoId="vid_9"
        />
      </ul>,
    );
    expect(screen.getByText('Uploaded just now')).toBeInTheDocument();
    expect(screen.getByText(/104,857,600 bytes/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Edit details/ })).toHaveAttribute(
      'href',
      '/admin/videos/vid_9',
    );
    expect(screen.getByRole('button', { name: /Replace/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Remove/ })).toBeInTheDocument();
  });

  it('a rejected file shows its reason as an alert', () => {
    render(
      <ul>
        <UploadLane
          lane={lane({
            status: 'rejected',
            message: 'movie.avi is not supported. Use MP4, MOV or MKV.',
          })}
          actions={actions()}
        />
      </ul>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'movie.avi is not supported. Use MP4, MOV or MKV.',
    );
  });
});
