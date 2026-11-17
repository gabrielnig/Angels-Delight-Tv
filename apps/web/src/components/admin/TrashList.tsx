'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { can } from '@/lib/admin/can';
import { formatDate } from '@/lib/admin/format';
import type { AccountRole } from '@ad/shared';
import type { VideoRecord } from '@/lib/data/admin/types';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { daysLeftInTrash } from '@/lib/data/admin/video-commands';
import { Button } from './Button';
import { ConfirmDialog } from './Dialog';
import { PosterTile, seedOf } from './PosterTile';
import { EmptyState } from './states';
import { useToast } from './Toast';

export function TrashList({
  videos,
  role,
  now,
  restore,
  purge,
}: {
  videos: VideoRecord[];
  role: AccountRole;
  now: number;
  restore: (id: string) => Promise<CommandResult>;
  purge: (id: string) => Promise<CommandResult>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<VideoRecord | null>(null);
  const canPurge = can(role, 'video.purge');

  async function act(id: string, fn: (id: string) => Promise<CommandResult>, done: string) {
    setBusyId(id);
    try {
      const result = await fn(id);
      toast.show(
        result.ok ? { tone: 'success', message: done } : { tone: 'danger', message: result.error },
      );
      router.refresh();
    } catch {
      toast.show({ tone: 'danger', message: 'That did not work. Nothing was changed. Try again.' });
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  }

  if (videos.length === 0) {
    return (
      <EmptyState
        title="Trash is empty."
        help="Videos you move to Trash wait here for 30 days."
        icon="trash"
      />
    );
  }
  return (
    <div className="adm-card adm-table-card">
      <table className="adm-table" style={{ display: 'table' }}>
        <caption className="adm-sr">Videos in Trash</caption>
        <thead>
          <tr>
            <th scope="col">Video</th>
            <th scope="col">Deleted</th>
            <th scope="col" className="adm-num">
              Days left
            </th>
            <th scope="col">
              <span className="adm-sr">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {videos.map((video) => {
            const left = daysLeftInTrash(video.deletedAt!, now);
            return (
              <tr key={video.id}>
                <td>
                  <div className="adm-vcell">
                    <PosterTile title={video.title} seed={seedOf(video.id)} />
                    <span className="adm-vtitle">{video.title}</span>
                  </div>
                </td>
                <td>{formatDate(video.deletedAt!)}</td>
                <td className="adm-num">{left}</td>
                <td>
                  <div className="adm-row">
                    <Button
                      loading={busyId === video.id}
                      aria-label={`Restore ${video.title}`}
                      onClick={() => act(video.id, restore, `${video.title} was restored.`)}
                    >
                      Restore
                    </Button>
                    <Button
                      variant="danger"
                      aria-label={`Delete ${video.title} forever`}
                      disabledReason={canPurge ? undefined : 'Only an admin can delete forever.'}
                      onClick={() => setConfirm(video)}
                    >
                      Delete forever
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ConfirmDialog
        open={confirm !== null}
        title={`Delete ${confirm?.title ?? 'this video'} forever?`}
        consequence="The video and its files are removed for good. This cannot be undone."
        confirmLabel="Delete forever"
        danger
        busy={busyId !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && act(confirm.id, purge, `${confirm.title} was deleted.`)}
      />
    </div>
  );
}
