'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import { can } from '@/lib/admin/can';
import { formatDate } from '@/lib/admin/format';
import type { AccountRole } from '@ad/shared';
import { describeOutcome, mergeOutcomes, newBulkId, type BulkOutcome } from '@/lib/data/admin/bulk';
import type { VideoRecord } from '@/lib/data/admin/types';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { daysLeftInTrash } from '@/lib/data/admin/video-commands';
import { BulkBar } from './bulk/BulkBar';
import { BulkProgress } from './bulk/BulkProgress';
import { BulkReport } from './bulk/BulkReport';
import { useBulkRun } from './bulk/useBulkRun';
import { useSelection } from './bulk/useSelection';
import { Button } from './Button';
import { TypedConfirmDialog } from './Dialog';
import { Checkbox } from './fields';
import { PosterTile, seedOf } from './PosterTile';
import { EmptyState } from './states';
import { useToast } from './Toast';

export function TrashList({
  videos,
  role,
  now,
  restore,
  purge,
  restoreMany,
  purgeMany,
  undoRestore,
}: {
  videos: VideoRecord[];
  role: AccountRole;
  now: number;
  restore: (id: string) => Promise<CommandResult>;
  purge: (id: string) => Promise<CommandResult>;
  restoreMany: (ids: string[], bulkId: string) => Promise<BulkOutcome>;
  purgeMany: (ids: string[], bulkId: string) => Promise<BulkOutcome>;
  undoRestore: (ids: string[]) => Promise<{ succeeded: string[]; failed: unknown[] }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<VideoRecord | null>(null);
  const canPurge = can(role, 'video.purge');
  const ids = useMemo(() => videos.map((v) => v.id), [videos]);
  const sel = useSelection(ids);
  const modeRef = useRef<'restore' | 'purge'>('restore');
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  const runner = useBulkRun(
    useCallback(
      (chunk, bulkId) => (modeRef.current === 'restore' ? restoreMany : purgeMany)(chunk, bulkId),
      [restoreMany, purgeMany],
    ),
  );
  const titleOf = (id: string) => videos.find((v) => v.id === id)?.title ?? id;
  const plural = (n: number) => `${n} ${n === 1 ? 'video' : 'videos'}`;

  async function undo(payload: unknown) {
    try {
      const r = await undoRestore(payload as string[]);
      toast.show({
        tone: r.failed.length ? 'danger' : 'success',
        message: r.failed.length
          ? `Undo moved ${r.succeeded.length} back. ${r.failed.length} were left alone.`
          : `Undone: ${r.succeeded.length} moved back to Trash.`,
      });
      router.refresh();
    } catch {
      toast.show({ tone: 'danger', message: 'Undo did not work. Nothing was changed.' });
    }
  }

  async function runBulk(mode: 'restore' | 'purge', list: string[], prior?: BulkOutcome) {
    modeRef.current = mode;
    setBulkConfirm(false);
    const result = await runner.start(list, prior?.bulkId ?? newBulkId());
    const merged = prior ? mergeOutcomes(prior, result) : result;
    if (merged.interrupted && merged.succeeded.length === 0 && merged.failed.length === 0) {
      toast.show({ tone: 'danger', message: 'That did not work. Nothing was changed. Try again.' });
      return;
    }
    setOutcome(merged);
    sel.clear();
    if (merged.succeeded.length > 0) {
      const payload = merged.undo?.payload;
      toast.show({
        tone: 'success',
        message:
          mode === 'purge'
            ? `${plural(merged.succeeded.length)} queued for deletion.`
            : `${describeOutcome('Restore', merged)} They are drafts.`,
        ...(mode === 'restore' && payload
          ? { actionLabel: 'Undo', durationMs: 10000, onAction: () => void undo(payload) }
          : {}),
      });
    }
    router.refresh();
  }

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
    <>
      {runner.running && (runner.progress?.total ?? 0) > 25 ? (
        <BulkProgress
          label={modeRef.current === 'restore' ? 'Restore' : 'Delete forever'}
          done={runner.progress?.done ?? 0}
          total={runner.progress?.total ?? 0}
          offline={runner.offline}
          onCancel={runner.cancel}
        />
      ) : null}
      {outcome ? (
        <BulkReport
          label={modeRef.current === 'restore' ? 'Restore' : 'Delete forever'}
          outcome={outcome}
          itemLabel={titleOf}
          onDismiss={() => setOutcome(null)}
          onRetry={(list) => void runBulk(modeRef.current, list, outcome)}
          onContinue={() => undefined}
        />
      ) : null}
      {sel.count > 0 ? (
        <BulkBar
          count={sel.count}
          onClear={sel.clear}
          actions={[
            {
              id: 'restore',
              label: `Restore ${sel.count}`,
              variant: 'primary',
              onClick: () => void runBulk('restore', [...sel.selected]),
            },
            {
              id: 'purge',
              label: `Delete forever ${sel.count}`,
              variant: 'danger',
              onClick: () => {
                modeRef.current = 'purge';
                setBulkConfirm(true);
              },
              disabledReason: canPurge ? undefined : 'Only an admin can delete forever.',
            },
          ]}
        />
      ) : null}
      <div className="adm-card adm-table-card">
        <table className="adm-table">
          <caption className="adm-sr">Videos in Trash</caption>
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
                <tr key={video.id} className={sel.isSelected(video.id) ? 'is-selected' : undefined}>
                  <td className="adm-table__check">
                    <Checkbox
                      label={`Select ${video.title}`}
                      checked={sel.isSelected(video.id)}
                      onChange={() => sel.toggle(video.id)}
                    />
                  </td>
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
                        aria-label={`Delete forever: ${video.title}`}
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
        <ul className="adm-cards" aria-label="Videos in Trash">
          {videos.map((video) => (
            <li
              key={video.id}
              className={`adm-vcard${sel.isSelected(video.id) ? ' is-selected' : ''}`}
            >
              <Checkbox
                label={`Select ${video.title}`}
                checked={sel.isSelected(video.id)}
                onChange={() => sel.toggle(video.id)}
              />
              <PosterTile title={video.title} seed={seedOf(video.id)} />
              <div className="adm-vcard__body">
                <span className="adm-vtitle">{video.title}</span>
                <span className="adm-muted">
                  Deleted {formatDate(video.deletedAt!)}, {daysLeftInTrash(video.deletedAt!, now)}{' '}
                  days left
                </span>
              </div>
            </li>
          ))}
        </ul>
        <TypedConfirmDialog
          open={confirm !== null}
          title={`Delete ${confirm?.title ?? 'this video'} forever?`}
          consequence="The video and its files are removed for good. This cannot be undone."
          phrase="delete"
          phraseLabel="Type delete to confirm"
          confirmLabel="Delete forever"
          busy={busyId !== null}
          onClose={() => setConfirm(null)}
          onConfirm={() => confirm && act(confirm.id, purge, `${confirm.title} was deleted.`)}
        />
        <TypedConfirmDialog
          open={bulkConfirm}
          title={`Delete ${plural(sel.count)} forever?`}
          consequence="The videos and their files are removed for good. This cannot be undone."
          phrase={String(sel.count)}
          phraseLabel={`Type ${sel.count} to delete ${plural(sel.count)} forever`}
          confirmLabel={`Delete forever ${sel.count}`}
          busy={runner.running}
          onClose={() => setBulkConfirm(false)}
          onConfirm={() => void runBulk('purge', [...sel.selected])}
        />
      </div>
    </>
  );
}
