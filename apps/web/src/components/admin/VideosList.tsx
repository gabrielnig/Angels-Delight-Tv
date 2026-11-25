'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { AccountRole } from '@ad/shared';
import { can } from '@/lib/admin/can';
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatDuration,
  spokenDuration,
} from '@/lib/admin/format';
import {
  MAX_BULK_CALL,
  describeOutcome,
  mergeOutcomes,
  newBulkId,
  toOutcome,
  type BulkOutcome,
  type BulkUndo,
} from '@/lib/data/admin/bulk';
import type { BulkAction, BulkResult, VideoQuery } from '@/lib/data/admin/video-queries';
import { serializeVideoQuery } from '@/lib/data/admin/video-queries';
import type { CategoryRecord, Page, VideoRecord } from '@/lib/data/admin/types';
import { adminStatusOf } from '@/lib/data/admin/video-rules';
import { CaptionBadge, StatusBadge } from './Badge';
import { Button, LinkButton } from './Button';
import { AddToSeriesDialog, type BundleDone } from './AddToSeriesDialog';
import type { SeriesLabelSetting } from '@ad/shared/series-labels';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { BulkBar, type BulkBarAction } from './bulk/BulkBar';
import { BulkProgress } from './bulk/BulkProgress';
import { BulkReport } from './bulk/BulkReport';
import { useBulkRun } from './bulk/useBulkRun';
import { useSelection } from './bulk/useSelection';
import { ConfirmDialog, Dialog, TypedConfirmDialog } from './Dialog';
import { Checkbox, SelectField, TextField } from './fields';
import { Icon } from './Icon';
import { PosterTile, seedOf } from './PosterTile';
import { EmptyState } from './states';
import { useToast } from './Toast';
import { useMaturityLabels } from '@/lib/maturity-context';

const STATUS_OPTIONS = [
  ['', 'All statuses'],
  ['published', 'Published'],
  ['scheduled', 'Scheduled'],
  ['ready', 'Ready'],
  ['needs_captions', 'Needs captions'],
  ['processing', 'Processing'],
  ['draft', 'Draft'],
  ['failed', 'Failed'],
] as const;
const CAPTION_OPTIONS = [
  ['', 'Any'],
  ['approved', 'Approved'],
  ['needs_review', 'Needs review'],
  ['generating', 'Generating'],
  ['none', 'None'],
] as const;
const SUITABILITY_OPTIONS = [
  ['', 'Any'],
  ['everyone', 'Everyone'],
  ['kids', 'Kids'],
  ['older', 'Older viewers'],
] as const;

interface Props {
  page: Page<VideoRecord>;
  query: VideoQuery;
  categories: CategoryRecord[];
  role: AccountRole;
  bulk: (ids: string[], action: BulkAction, bulkId: string) => Promise<BulkResult>;
  /** Puts back what the last run changed. Compare and set on the server. */
  undo?: (undo: BulkUndo) => Promise<BulkResult>;
  /** Ids that match the current filter, for "Select all N that match". */
  matching?: (query: VideoQuery) => Promise<string[]>;
  /** Bundling into a series (M51-S04). Without it the Add to series action is not offered. */
  bundle?: {
    series: Array<{ id: string; title: string; labels?: SeriesLabelSetting }>;
    existing: (seriesId: string) => Promise<Array<{ group: number; number: number }>>;
    setEpisode: (
      videoId: string,
      seriesId: string | null,
      group: number | null,
      number: number | null,
    ) => Promise<CommandResult>;
    createSeries: (
      title: string,
    ) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  };
  now: number;
}

/** Page scope only. These never run on a "select all that match" snapshot (L3-D05). */
const PAGE_ONLY = new Set(['publish', 'unpublish', 'trash']);
const TYPED_COUNT_AT = 5;
const plural = (n: number) => `${n} ${n === 1 ? 'video' : 'videos'}`;
const labelOf = (action: BulkAction): string =>
  ({
    publish: 'Publish',
    unpublish: 'Unpublish',
    trash: 'Move to Trash',
    category: 'Add to category',
    remove_category: 'Remove from category',
    suitability: 'Set suitability',
    maturity: 'Set maturity rating',
    captions_available: 'Captions for viewers',
  })[action.type];

const options = (list: ReadonlyArray<readonly [string, string]>) =>
  list.map(([value, label]) => ({ value, label }));

export function VideosList({ page, query, categories, role, bulk, undo, matching, bundle }: Props) {
  const [bundling, setBundling] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const maturityLabels = useMaturityLabels();
  const [pending, start] = useTransition();
  const [compact, setCompact] = useState(false);
  const [q, setQ] = useState(query.q ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<BulkAction>({ type: 'publish' });
  const ids = useMemo(() => page.items.map((v) => v.id), [page.items]);
  const sel = useSelection(ids);
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  const [lastRun, setLastRun] = useState<{ action: BulkAction; ids: string[] } | null>(null);
  const [confirm, setConfirm] = useState<'publish' | 'trash' | null>(null);
  const [picker, setPicker] = useState<
    'category' | 'remove_category' | 'maturity' | 'captions' | null
  >(null);
  const [pickValue, setPickValue] = useState('');
  const [pickReason, setPickReason] = useState('');
  const canPublish = can(role, 'video.publish');
  const canTrash = can(role, 'video.delete');
  const canEdit = can(role, 'video.edit');
  const canCaptions = can(role, 'caption.availability');
  const filtered = Boolean(
    query.q || query.status || query.categoryId || query.captions || query.suitability,
  );
  const runner = useBulkRun(
    useCallback(
      async (chunk, bulkId) => toOutcome(await bulk(chunk, actionRef.current, bulkId), bulkId),
      [bulk],
    ),
  );
  const queryKey = serializeVideoQuery(query);
  const clearSelection = sel.clear;

  useEffect(() => clearSelection(), [queryKey, clearSelection]);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const go = (next: VideoQuery) => {
    const qs = serializeVideoQuery({ ...next, cursor: undefined });
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  };
  const setFilter = (patch: Partial<VideoQuery>) => go({ ...query, ...patch });
  const onSearch = (value: string) => {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFilter({ q: value.trim() || undefined }), 350);
  };

  const titleOf = (id: string) => page.items.find((v) => v.id === id)?.title ?? id;
  const selectedIds = [...sel.selected];

  async function doUndo(payload: BulkUndo) {
    if (!undo) return;
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

  async function run(action: BulkAction, idsToRun: string[], prior?: BulkOutcome) {
    const label = labelOf(action);
    actionRef.current = action;
    setLastRun({ action, ids: prior && lastRun ? lastRun.ids : idsToRun });
    setConfirm(null);
    setPicker(null);
    setPickValue('');
    setPickReason('');
    // Suitability and maturity are all or nothing (M35-S04), so they go in one call, not in chunks.
    const result = await runner.start(
      idsToRun,
      prior?.bulkId ?? newBulkId(),
      action.type === 'maturity' || action.type === 'suitability' ? MAX_BULK_CALL : undefined,
    );
    const merged = prior ? mergeOutcomes(prior, result) : result;
    const nothingHappened =
      merged.interrupted !== undefined &&
      merged.succeeded.length === 0 &&
      merged.failed.length === 0 &&
      merged.skipped.length === 0;
    if (nothingHappened) {
      setOutcome(null);
      toast.show({
        tone: 'danger',
        message: `${label} did not work. Nothing was changed. Try again.`,
      });
      return;
    }
    setOutcome(merged);
    sel.clear();
    if (merged.succeeded.length > 0) {
      const payload = merged.undo;
      toast.show({
        tone: 'success',
        message: describeOutcome(label, merged),
        ...(payload && undo
          ? { actionLabel: 'Undo', durationMs: 10000, onAction: () => void doUndo(payload) }
          : {}),
      });
    }
    router.refresh();
  }

  const pageOnlyReason =
    sel.scope === 'matching' ? 'Select rows on this page to use this action.' : undefined;
  const actions: BulkBarAction[] = [
    {
      id: 'publish',
      label: 'Publish',
      variant: 'primary',
      onClick: () => setConfirm('publish'),
      disabledReason: !canPublish ? 'Your role cannot publish.' : pageOnlyReason,
    },
    {
      id: 'unpublish',
      label: 'Unpublish',
      onClick: () => void run({ type: 'unpublish' }, selectedIds),
      disabledReason: !canPublish ? 'Your role cannot publish.' : pageOnlyReason,
    },
    {
      id: 'category',
      label: 'Add to category',
      secondary: true,
      onClick: () => setPicker('category'),
      disabledReason: canEdit ? undefined : 'Your role cannot edit videos.',
    },
    {
      id: 'remove_category',
      label: 'Remove from category',
      secondary: true,
      onClick: () => setPicker('remove_category'),
      disabledReason: canEdit ? undefined : 'Your role cannot edit videos.',
    },
    ...(bundle
      ? [
          {
            id: 'add_to_series',
            label: 'Add to series',
            secondary: true,
            onClick: () => setBundling(true),
            disabledReason: !can(role, 'series.manage')
              ? 'Your role cannot manage series.'
              : sel.scope === 'matching'
                ? 'Select rows on this page to use this action.'
                : undefined,
          } satisfies BulkBarAction,
        ]
      : []),
    {
      id: 'maturity',
      label: 'Set maturity rating',
      secondary: true,
      onClick: () => setPicker('maturity'),
      disabledReason: canEdit ? undefined : 'Your role cannot edit videos.',
    },
    {
      id: 'captions',
      label: 'Captions for viewers',
      secondary: true,
      onClick: () => setPicker('captions'),
      disabledReason: canCaptions ? undefined : 'Only an admin can change captions for viewers.',
    },
    {
      id: 'trash',
      label: 'Move to Trash',
      variant: 'danger',
      onClick: () => setConfirm('trash'),
      disabledReason: !canTrash ? 'Only an admin can move videos to Trash.' : pageOnlyReason,
    },
  ];
  const pickerOptions =
    picker === 'maturity'
      ? maturityLabels.map((label, rank) => ({ value: String(rank), label }))
      : categories.map((c) => ({ value: c.id, label: c.name }));
  const applyPicker = () => {
    if (!picker || !pickValue) return;
    if (picker === 'captions') {
      const value = pickValue === 'on' ? true : pickValue === 'off' ? false : null;
      void run(
        value === false
          ? { type: 'captions_available', value, reason: pickReason.trim() }
          : { type: 'captions_available', value },
        selectedIds,
      );
      return;
    }
    const action: BulkAction =
      picker === 'maturity'
        ? { type: 'maturity', value: Number(pickValue) }
        : { type: picker, categoryId: pickValue };
    void run(action, selectedIds);
  };

  const bundleVideos = selectedIds.flatMap((id) => {
    const v = page.items.find((item) => item.id === id);
    return v ? [{ id: v.id, title: v.title, uploadedAt: v.createdAt }] : [];
  });
  function bundled(done: BundleDone) {
    sel.clear();
    toast.show({
      tone: 'success',
      message: `${done.added} ${done.added === 1 ? 'video' : 'videos'} added to the series.`,
      actionLabel: 'Undo',
      durationMs: 10000,
      onAction: () =>
        void done.undo().then(() => {
          toast.show({ tone: 'success', message: 'Undone: the videos are standalone again.' });
          router.refresh();
        }),
    });
    router.refresh();
  }

  return (
    <div className="adm-stack">
      {bundle ? (
        <AddToSeriesDialog
          open={bundling}
          videos={bundleVideos}
          series={bundle.series}
          existing={bundle.existing}
          setEpisode={bundle.setEpisode}
          createSeries={bundle.createSeries}
          onClose={() => setBundling(false)}
          onDone={bundled}
        />
      ) : null}
      <form
        className="adm-card adm-filters"
        role="search"
        aria-label="Filter videos"
        onSubmit={(e) => {
          e.preventDefault();
          setFilter({ q: q.trim() || undefined });
        }}
      >
        <TextField
          label="Search"
          type="search"
          value={q}
          placeholder="Title or tag"
          onChange={(e) => onSearch(e.target.value)}
        />
        <SelectField
          label="Status"
          value={query.status ?? ''}
          options={options(STATUS_OPTIONS)}
          onChange={(e) =>
            setFilter({ status: (e.target.value || undefined) as VideoQuery['status'] })
          }
        />
        <SelectField
          label="Category"
          value={query.categoryId ?? ''}
          options={[
            { value: '', label: 'All categories' },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          onChange={(e) => setFilter({ categoryId: e.target.value || undefined })}
        />
        <SelectField
          label="Captions"
          value={query.captions ?? ''}
          options={options(CAPTION_OPTIONS)}
          onChange={(e) =>
            setFilter({ captions: (e.target.value || undefined) as VideoQuery['captions'] })
          }
        />
        <SelectField
          label="Suitability"
          value={query.suitability ?? ''}
          options={options(SUITABILITY_OPTIONS)}
          onChange={(e) =>
            setFilter({ suitability: (e.target.value || undefined) as VideoQuery['suitability'] })
          }
        />
        <Checkbox
          label="Compact rows"
          checked={compact}
          onChange={(e) => setCompact(e.target.checked)}
        />
      </form>

      {runner.running && (runner.progress?.total ?? 0) > 25 ? (
        <BulkProgress
          label={labelOf(actionRef.current)}
          done={runner.progress?.done ?? 0}
          total={runner.progress?.total ?? 0}
          offline={runner.offline}
          onCancel={runner.cancel}
        />
      ) : null}

      {outcome && lastRun ? (
        <BulkReport
          label={labelOf(lastRun.action)}
          outcome={outcome}
          itemLabel={titleOf}
          itemHref={(id) => `/admin/videos/${id}`}
          onDismiss={() => setOutcome(null)}
          onRetry={(retryIds) => void run(lastRun.action, retryIds, outcome)}
          onContinue={() =>
            void run(lastRun.action, lastRun.ids.slice(outcome.interrupted?.done ?? 0), {
              ...outcome,
              interrupted: undefined,
            })
          }
        />
      ) : null}

      {sel.count > 0 ? (
        <BulkBar
          count={sel.count}
          onClear={sel.clear}
          actions={actions}
          pageFullySelected={sel.allOnPage && sel.scope === 'page'}
          matchTotal={page.total}
          onSelectMatching={
            matching
              ? async () => {
                  try {
                    sel.selectMatching(await matching(query));
                  } catch {
                    toast.show({
                      tone: 'danger',
                      message: 'Could not select the rest. Try again.',
                    });
                  }
                }
              : undefined
          }
          note={
            sel.capped
              ? `Selected ${sel.capped.used}. The first ${sel.capped.used} are used when more match.`
              : undefined
          }
          returnFocusTo={() => tableRef.current}
        />
      ) : null}

      <div
        className="adm-card adm-table-card"
        aria-busy={pending || undefined}
        ref={tableRef}
        tabIndex={-1}
      >
        {page.items.length === 0 ? (
          filtered ? (
            <EmptyState
              live
              icon="search"
              title="No videos match."
              help="Try a different word or clear the filters."
              action={
                <Button
                  onClick={() => {
                    setQ('');
                    go({});
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No videos yet."
              help="Upload your first video to get started."
              action={
                <LinkButton href="/admin/videos/upload" variant="accent" icon="upload">
                  Upload videos
                </LinkButton>
              }
            />
          )
        ) : (
          <>
            <table className={`adm-table${compact ? ' is-compact' : ''}`}>
              <caption className="adm-sr">Videos</caption>
              <thead>
                <tr>
                  <th scope="col" className="adm-table__check">
                    <Checkbox
                      label="Select all on this page"
                      checked={sel.allOnPage}
                      mixed={sel.someOnPage && !sel.allOnPage}
                      onChange={sel.togglePage}
                    />
                  </th>
                  <th scope="col">Video</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="adm-num">
                    Length
                  </th>
                  <th scope="col">Captions</th>
                  <th scope="col">Published</th>
                  <th scope="col" className="adm-num">
                    Views
                  </th>
                  <th scope="col">
                    <span className="adm-sr">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((video) => {
                  const status = adminStatusOf(video);
                  const isSel = sel.isSelected(video.id);
                  return (
                    <tr key={video.id} className={isSel ? 'is-selected' : undefined}>
                      <td className="adm-table__check">
                        <Checkbox
                          label={`Select ${video.title}`}
                          checked={isSel}
                          onChange={() => sel.toggle(video.id)}
                        />
                      </td>
                      <td>
                        <div className="adm-vcell">
                          <PosterTile title={video.title} seed={seedOf(video.id)} />
                          <div>
                            <Link className="adm-vtitle" href={`/admin/videos/${video.id}`}>
                              {video.title}
                            </Link>
                            <div className="adm-muted">
                              {video.categoryIds
                                .map((id) => categories.find((c) => c.id === id)?.name)
                                .filter(Boolean)
                                .join(', ') || 'No category'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={status} />
                      </td>
                      <td className="adm-num">
                        {video.durationSeconds ? (
                          <>
                            <span aria-hidden="true">{formatDuration(video.durationSeconds)}</span>
                            <span className="adm-sr">{spokenDuration(video.durationSeconds)}</span>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <CaptionBadge state={video.captionState} />
                      </td>
                      <td>
                        {video.publishState === 'published' && video.publishedAt ? (
                          formatDate(video.publishedAt)
                        ) : video.publishState === 'scheduled' && video.publishAt ? (
                          formatDateTime(video.publishAt)
                        ) : (
                          <span className="adm-muted">Not published</span>
                        )}
                      </td>
                      <td className="adm-num">{formatCount(video.views)}</td>
                      <td>
                        <LinkButton
                          href={`/admin/videos/${video.id}`}
                          variant="ghost"
                          aria-label={`Edit ${video.title}`}
                        >
                          Edit
                        </LinkButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <ul className="adm-cards" aria-label="Videos">
              {page.items.map((video) => (
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
                    <Link className="adm-vtitle" href={`/admin/videos/${video.id}`}>
                      {video.title}
                    </Link>
                    <div className="adm-row">
                      <StatusBadge status={adminStatusOf(video)} />
                      <span className="adm-muted">
                        {video.durationSeconds ? formatDuration(video.durationSeconds) : ''}
                      </span>
                    </div>
                    <span className="adm-muted">{formatCount(video.views)} views</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="adm-table__foot">
              <span>
                {page.prevCursor !== undefined ? (
                  <>
                    Showing {page.items.length} of {page.total} videos
                  </>
                ) : (
                  <>
                    Showing {Number(query.cursor ?? 0) + 1} to{' '}
                    {Number(query.cursor ?? 0) + page.items.length} of {page.total} videos
                  </>
                )}
              </span>
              <span className="adm-row">
                <Button
                  disabled={page.prevCursor !== undefined ? !page.prevCursor : !query.cursor}
                  onClick={() =>
                    start(() =>
                      router.replace(
                        `${pathname}?${serializeVideoQuery({ ...query, cursor: page.prevCursor !== undefined ? (page.prevCursor ?? undefined) : String(Math.max(0, Number(query.cursor ?? 0) - (query.limit ?? 10))) || undefined })}`,
                      ),
                    )
                  }
                >
                  <Icon name="left" size={16} /> Previous
                </Button>
                <Button
                  disabled={!page.nextCursor}
                  onClick={() =>
                    start(() =>
                      router.replace(
                        `${pathname}?${serializeVideoQuery({ ...query, cursor: page.nextCursor ?? undefined })}`,
                      ),
                    )
                  }
                >
                  Next <Icon name="right" size={16} />
                </Button>
              </span>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirm === 'publish'}
        title={`Publish ${plural(sel.count)}?`}
        consequence="They show to viewers right away. Videos that are not ready are skipped and listed."
        confirmLabel={`Publish ${sel.count}`}
        busy={runner.running}
        onClose={() => setConfirm(null)}
        onConfirm={() => void run({ type: 'publish' }, selectedIds)}
      />
      {sel.count >= TYPED_COUNT_AT ? (
        <TypedConfirmDialog
          open={confirm === 'trash'}
          title={`Move ${plural(sel.count)} to Trash?`}
          consequence="They stop showing to viewers right away. You can restore them for 30 days."
          phrase={String(sel.count)}
          phraseLabel={`Type ${sel.count} to confirm`}
          confirmLabel="Move to Trash"
          busy={runner.running}
          onClose={() => setConfirm(null)}
          onConfirm={() => void run({ type: 'trash' }, selectedIds)}
        />
      ) : (
        <ConfirmDialog
          open={confirm === 'trash'}
          title={`Move ${plural(sel.count)} to Trash?`}
          consequence="They stop showing to viewers right away. You can restore them for 30 days."
          confirmLabel="Move to Trash"
          danger
          busy={runner.running}
          onClose={() => setConfirm(null)}
          onConfirm={() => void run({ type: 'trash' }, selectedIds)}
        />
      )}
      <Dialog
        open={picker !== null}
        onClose={() => {
          setPicker(null);
          setPickValue('');
          setPickReason('');
        }}
        title={
          picker === 'captions'
            ? `Captions for viewers on ${plural(sel.count)}`
            : picker === 'maturity'
              ? `Set maturity rating for ${plural(sel.count)}`
              : picker === 'remove_category'
                ? `Remove ${plural(sel.count)} from a category`
                : `Add ${plural(sel.count)} to a category`
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPicker(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={
                !pickValue ||
                (picker === 'captions' && pickValue === 'off' && pickReason.trim().length < 5)
              }
              onClick={applyPicker}
            >
              Apply
            </Button>
          </>
        }
      >
        {picker === 'captions' ? (
          <>
            <SelectField
              label="Captions"
              value={pickValue}
              options={[
                { value: '', label: 'Choose one' },
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
                { value: 'default', label: 'Follow site default' },
              ]}
              onChange={(e) => setPickValue(e.target.value)}
            />
            {pickValue === 'off' ? (
              <TextField
                label="Reason"
                value={pickReason}
                hint="At least 5 characters. Kept with each video and in the log."
                onChange={(e) => setPickReason(e.target.value)}
              />
            ) : null}
          </>
        ) : (
          <SelectField
            label={picker === 'maturity' ? 'Maturity rating' : 'Category'}
            value={pickValue}
            options={[
              { value: '', label: picker === 'maturity' ? 'Choose a rating' : 'Choose one' },
              ...pickerOptions,
            ]}
            onChange={(e) => setPickValue(e.target.value)}
          />
        )}
      </Dialog>
    </div>
  );
}
