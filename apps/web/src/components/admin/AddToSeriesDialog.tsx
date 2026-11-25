'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  groupName,
  groupWord,
  itemName,
  itemWord,
  resolveSeriesLabels,
  type SeriesLabelSetting,
} from '@ad/shared/series-labels';
import { describeIssue, planBundle, type BundleOrder, type BundleVideo } from '@/lib/series-bundle';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { SelectField, TextField } from './fields';

const NEW = '__new__';

export interface BundleDone {
  added: number;
  seriesId: string;
  /** Takes every added video out of the series again. */
  undo: () => Promise<void>;
}

/**
 * Bulk "Add to series" from the Videos list (M51-S04): choose or create a series, a group, how to number, see
 * the result before saving, and undo afterwards. Words come from the chosen series.
 */
export function AddToSeriesDialog({
  open,
  videos,
  series,
  existing,
  setEpisode,
  createSeries,
  onClose,
  onDone,
}: {
  open: boolean;
  videos: BundleVideo[];
  series: Array<{ id: string; title: string; labels?: SeriesLabelSetting }>;
  existing: (seriesId: string) => Promise<Array<{ group: number; number: number }>>;
  setEpisode: (
    videoId: string,
    seriesId: string | null,
    group: number | null,
    number: number | null,
  ) => Promise<CommandResult>;
  createSeries: (title: string) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  onClose: () => void;
  onDone: (done: BundleDone) => void;
}) {
  const [seriesId, setSeriesId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [group, setGroup] = useState(1);
  const [startAt, setStartAt] = useState(1);
  const [order, setOrder] = useState<BundleOrder>('picked');
  const [taken, setTaken] = useState<Array<{ group: number; number: number }>>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();

  const chosen = series.find((s) => s.id === seriesId);
  const words = resolveSeriesLabels(chosen?.labels, null);

  useEffect(() => {
    let live = true;
    if (!seriesId || seriesId === NEW) {
      setTaken([]);
      return;
    }
    void existing(seriesId).then((list) => {
      if (live) setTaken(list);
    });
    return () => {
      live = false;
    };
  }, [seriesId, existing]);

  const plan = useMemo(
    () => planBundle({ videos, order, group, startAt, existing: taken }),
    [videos, order, group, startAt, taken],
  );
  const needsTitle = seriesId === NEW && newTitle.trim() === '';
  const ready = seriesId !== '' && !needsTitle && !plan.blocked && videos.length > 0;
  const count = `${videos.length} ${videos.length === 1 ? 'video' : 'videos'}`;

  async function save() {
    setBusy(true);
    setFailure(undefined);
    let target = seriesId;
    if (seriesId === NEW) {
      const made = await createSeries(newTitle.trim());
      if (!made.ok) {
        setBusy(false);
        setFailure(made.error);
        return;
      }
      target = made.id;
    }
    let added = 0;
    for (const row of plan.rows) {
      const result = await setEpisode(row.id, target, row.group, row.number);
      if (!result.ok) {
        setBusy(false);
        setFailure(
          `${result.error} ${added} of ${plan.rows.length} added. Fix this and try again.`,
        );
        return;
      }
      added += 1;
    }
    const ids = plan.rows.map((r) => r.id);
    setBusy(false);
    onDone({
      added,
      seriesId: target,
      undo: async () => {
        for (const id of ids) await setEpisode(id, null, null, null);
      },
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Add ${count} to a series`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} disabled={!ready} onClick={() => void save()}>
            {`Add ${count}`}
          </Button>
        </>
      }
    >
      <div className="adm-stack">
        <SelectField
          label="Series"
          value={seriesId}
          onChange={(e) => setSeriesId(e.target.value)}
          options={[
            { value: '', label: 'Choose a series' },
            ...series.map((s) => ({ value: s.id, label: s.title })),
            { value: NEW, label: 'Create a new series' },
          ]}
        />
        {seriesId === NEW ? (
          <TextField
            label="New series title"
            value={newTitle}
            maxLength={80}
            onChange={(e) => setNewTitle(e.target.value)}
          />
        ) : null}
        {seriesId ? (
          <>
            <div className="adm-grid-2">
              <TextField
                label={groupWord(words, 1)}
                type="number"
                min={1}
                inputMode="numeric"
                value={group}
                onChange={(e) => setGroup(Math.floor(Number(e.target.value)))}
              />
              <TextField
                label={`Start at ${itemWord(words, 1)}`}
                type="number"
                min={1}
                inputMode="numeric"
                value={startAt}
                onChange={(e) => setStartAt(Math.floor(Number(e.target.value)))}
              />
            </div>
            <SelectField
              label="Number them"
              value={order}
              onChange={(e) => setOrder(e.target.value as BundleOrder)}
              options={[
                { value: 'picked', label: 'In the order I picked them' },
                { value: 'title', label: 'By title' },
                { value: 'date', label: 'By upload date, oldest first' },
              ]}
            />
            {plan.problem ? (
              <p className="adm-field__error" role="alert">
                {describeIssue(plan.problem, words)}
              </p>
            ) : null}
            <table className="adm-table" aria-label="Preview">
              <thead>
                <tr>
                  <th scope="col">Video</th>
                  <th scope="col">Place in the series</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>{`${groupName(words, row.group)}, ${itemName(words, row.number)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
        {failure ? (
          <p className="adm-field__error" role="alert">
            {failure}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
