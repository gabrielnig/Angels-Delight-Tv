'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { AccountRole } from '@ad/shared';
import { can } from '@/lib/admin/can';
import { describeOutcome, mergeOutcomes, newBulkId, type BulkOutcome, type BulkUndo } from '@/lib/data/admin/bulk';
import type { SeriesBulkAction } from '@/lib/data/admin/series-bulk';
import type { SeriesRow } from '@/lib/data/admin/services';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { Badge } from './Badge';
import { BulkBar } from './bulk/BulkBar';
import { BulkReport } from './bulk/BulkReport';
import { useBulkRun } from './bulk/useBulkRun';
import { useSelection } from './bulk/useSelection';
import { Button } from './Button';
import { Dialog, TypedConfirmDialog } from './Dialog';
import { Checkbox, TextArea, TextField } from './fields';
import { EmptyState } from './states';
import { useToast } from './Toast';
import { useCommand } from './useCommand';

export function SeriesList({
  series,
  canManage,
  role,
  create,
  bulk,
  undo,
}: {
  series: SeriesRow[];
  canManage: boolean;
  role: AccountRole;
  bulk: (ids: string[], action: SeriesBulkAction, bulkId: string) => Promise<BulkOutcome>;
  undo: (undo: BulkUndo) => Promise<{ succeeded: string[]; failed: unknown[] }>;
  create: (title: string, description: string) => Promise<CommandResult>;
}) {
  const { run, busy } = useCommand();
  const router = useRouter();
  const toast = useToast();
  const ids = useMemo(() => series.map((s) => s.id), [series]);
  const sel = useSelection(ids);
  const actionRef = useRef<SeriesBulkAction>({ type: 'publish' });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  const [lastAction, setLastAction] = useState<SeriesBulkAction>({ type: 'publish' });
  const runner = useBulkRun(
    useCallback((chunk, bulkId) => bulk(chunk, actionRef.current, bulkId), [bulk]),
  );
  const canDelete = can(role, 'series.delete');
  const titleOf = (id: string) => series.find((s) => s.id === id)?.title ?? id;
  const labelOf = (a: SeriesBulkAction) =>
    a.type === 'publish' ? 'Publish' : a.type === 'unpublish' ? 'Unpublish' : 'Delete';

  async function doUndo(payload: BulkUndo) {
    try {
      const r = await undo(payload);
      toast.show({
        tone: r.failed.length ? 'danger' : 'success',
        message: r.failed.length
          ? `Undo put back ${r.succeeded.length}. ${r.failed.length} could not be put back.`
          : `Undone: ${r.succeeded.length} put back.`,
      });
      router.refresh();
    } catch {
      toast.show({ tone: 'danger', message: 'Undo did not work. Nothing was changed.' });
    }
  }

  async function runBulk(action: SeriesBulkAction, list: string[], prior?: BulkOutcome) {
    actionRef.current = action;
    setLastAction(action);
    setConfirmDelete(false);
    const result = await runner.start(list, prior?.bulkId ?? newBulkId());
    const merged = prior ? mergeOutcomes(prior, result) : result;
    if (merged.interrupted && merged.succeeded.length === 0 && merged.failed.length === 0) {
      toast.show({ tone: 'danger', message: `${labelOf(action)} did not work. Nothing was changed. Try again.` });
      return;
    }
    setOutcome(merged);
    sel.clear();
    if (merged.succeeded.length > 0) {
      const payload = merged.undo;
      toast.show({
        tone: 'success',
        message: describeOutcome(labelOf(action), merged),
        ...(payload ? { actionLabel: 'Undo', durationMs: 10000, onAction: () => void doUndo(payload) } : {}),
      });
    }
    router.refresh();
  }
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string>();

  async function save() {
    const result = await run(() => create(title, description), 'Series created as a draft.');
    if (result.ok) {
      setOpen(false);
      setTitle('');
      setDescription('');
    } else setError(result.error);
  }
  return (
    <div className="adm-stack">
      <div className="adm-row">
        <Button
          variant="primary"
          icon="plus"
          disabled={!canManage}
          onClick={() => {
            setError(undefined);
            setOpen(true);
          }}
        >
          New series
        </Button>
      </div>
      {outcome ? (
        <BulkReport
          label={labelOf(lastAction)}
          outcome={outcome}
          itemLabel={titleOf}
          itemHref={(id) => `/admin/series/${id}`}
          onDismiss={() => setOutcome(null)}
          onRetry={(list) => void runBulk(lastAction, list, outcome)}
        />
      ) : null}
      {sel.count > 0 ? (
        <BulkBar
          count={sel.count}
          onClear={sel.clear}
          actions={[
            {
              id: 'publish',
              label: 'Publish',
              variant: 'primary',
              onClick: () => void runBulk({ type: 'publish' }, [...sel.selected]),
              disabledReason: canManage ? undefined : 'Your role cannot manage series.',
            },
            {
              id: 'unpublish',
              label: 'Unpublish',
              onClick: () => void runBulk({ type: 'unpublish' }, [...sel.selected]),
              disabledReason: canManage ? undefined : 'Your role cannot manage series.',
            },
            {
              id: 'delete',
              label: 'Delete',
              variant: 'danger',
              onClick: () => setConfirmDelete(true),
              disabledReason: canDelete ? undefined : 'Only an admin can delete a series.',
            },
          ]}
        />
      ) : null}
      {series.length === 0 ? (
        <EmptyState
          title="No series yet."
          help="A series groups episodes into seasons. Create one, then add videos to it."
          icon="series"
        />
      ) : (
        <ul className="adm-cardlist" aria-label="Series">
          {series.map((s) => (
            <li key={s.id} className="adm-card adm-listrow">
              <div className="adm-listrow__main">
                <Checkbox
                  label={`Select ${s.title}`}
                  checked={sel.isSelected(s.id)}
                  onChange={() => sel.toggle(s.id)}
                />
                <Link href={`/admin/series/${s.id}`} className="adm-link">
                  <strong>{s.title}</strong>
                </Link>
                <span className="adm-muted">
                  {s.episodeCount} {s.episodeCount === 1 ? 'episode' : 'episodes'}
                </span>
                <Badge
                  tone={s.published ? 'success' : 'neutral'}
                  icon={s.published ? 'check' : 'clock'}
                >
                  {s.published ? 'Published' : 'Draft'}
                </Badge>
              </div>
              <p className="adm-muted" style={{ margin: 0 }}>
                {s.description || 'No description yet.'}
              </p>
            </li>
          ))}
        </ul>
      )}
      <TypedConfirmDialog
        open={confirmDelete}
        title={`Delete ${sel.count} ${sel.count === 1 ? 'series' : 'series'}?`}
        consequence="The series and its seasons are removed. The videos stay in the library as single videos."
        phrase={String(sel.count)}
        phraseLabel={`Type ${sel.count} to confirm`}
        confirmLabel={`Delete ${sel.count} series`}
        busy={runner.running}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void runBulk({ type: 'delete' }, [...sel.selected])}
      />
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New series"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={save}>
              Create series
            </Button>
          </>
        }
      >
        <TextField
          label="Title"
          value={title}
          maxLength={80}
          error={error}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextArea
          label="Description"
          hint="One or two sentences viewers will read."
          value={description}
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Dialog>
    </div>
  );
}
