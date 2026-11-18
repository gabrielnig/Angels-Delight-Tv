'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { AccountRole } from '@ad/shared';
import { can } from '@/lib/admin/can';
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatDuration,
  spokenDuration,
} from '@/lib/admin/format';
import type { BulkAction, BulkResult, VideoQuery } from '@/lib/data/admin/video-queries';
import { serializeVideoQuery } from '@/lib/data/admin/video-queries';
import type { CategoryRecord, Page, VideoRecord } from '@/lib/data/admin/types';
import { adminStatusOf } from '@/lib/data/admin/video-rules';
import { CaptionBadge, StatusBadge } from './Badge';
import { Button, LinkButton } from './Button';
import { ConfirmDialog } from './Dialog';
import { Checkbox, SelectField, TextField } from './fields';
import { Icon } from './Icon';
import { PosterTile, seedOf } from './PosterTile';
import { Banner, EmptyState } from './states';
import { useToast } from './Toast';

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
  bulk: (ids: string[], action: BulkAction) => Promise<BulkResult>;
  now: number;
}

const options = (list: ReadonlyArray<readonly [string, string]>) =>
  list.map(([value, label]) => ({ value, label }));

export function VideosList({ page, query, categories, role, bulk }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compact, setCompact] = useState(false);
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [categoryPick, setCategoryPick] = useState('');
  const [summary, setSummary] = useState<{
    done: number;
    failed: BulkResult['failed'];
    label: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState(query.q ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canPublish = can(role, 'video.publish');
  const canTrash = can(role, 'video.delete');
  const filtered = Boolean(
    query.q || query.status || query.categoryId || query.captions || query.suitability,
  );

  useEffect(() => setSelected(new Set()), [page]);
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

  const ids = page.items.map((v) => v.id);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  async function run(idsToRun: string[], action: BulkAction, label: string) {
    setBusy(true);
    try {
      const result = await bulk(idsToRun, action);
      setSummary({ done: result.succeeded.length, failed: result.failed, label });
      if (result.failed.length === 0)
        toast.show({ tone: 'success', message: `${label}: ${result.succeeded.length} done.` });
      setSelected(new Set());
      router.refresh();
    } catch {
      toast.show({
        tone: 'danger',
        message: `${label} did not work. Nothing was changed. Try again.`,
      });
    } finally {
      setBusy(false);
      setConfirmTrash(false);
    }
  }

  const titleOf = (id: string) => page.items.find((v) => v.id === id)?.title ?? id;
  const selectedIds = [...selected];
  const hasSelection = selectedIds.length > 0;

  return (
    <div className="adm-stack">
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

      {summary ? (
        <Banner
          tone={summary.failed.length ? 'warning' : 'success'}
          action={
            <Button variant="ghost" onClick={() => setSummary(null)}>
              Dismiss
            </Button>
          }
        >
          <strong>
            {summary.label}: {summary.done} done
            {summary.failed.length ? `, ${summary.failed.length} could not be changed` : ''}.
          </strong>
          {summary.failed.length ? (
            <ul style={{ margin: 'var(--space-1) 0 0', paddingLeft: 'var(--space-5)' }}>
              {summary.failed.map((f) => (
                <li key={f.id}>
                  {titleOf(f.id)}: {f.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </Banner>
      ) : null}

      {hasSelection ? (
        <div className="adm-bulk" role="region" aria-label="Bulk actions">
          <strong>{selectedIds.length} selected</strong>
          <Button
            variant="primary"
            loading={busy}
            disabledReason={canPublish ? undefined : 'Your role cannot publish.'}
            onClick={() => run(selectedIds, { type: 'publish' }, 'Publish')}
          >
            Publish
          </Button>
          <Button
            disabled={busy || !canPublish}
            onClick={() => run(selectedIds, { type: 'unpublish' }, 'Unpublish')}
          >
            Unpublish
          </Button>
          <SelectField
            label="Add to category"
            value={categoryPick}
            options={[
              { value: '', label: 'Add to category' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            onChange={(e) => {
              const id = e.target.value;
              setCategoryPick('');
              if (id)
                void run(selectedIds, { type: 'category', categoryId: id }, 'Add to category');
            }}
          />
          <SelectField
            label="Set suitability"
            value=""
            options={[
              { value: '', label: 'Set suitability' },
              ...SUITABILITY_OPTIONS.filter(([value]) => value).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
            onChange={(e) => {
              const value = e.target.value as 'everyone' | 'kids' | 'older' | '';
              if (value) void run(selectedIds, { type: 'suitability', value }, 'Set suitability');
            }}
          />
          <Button
            variant="danger"
            disabledReason={canTrash ? undefined : 'Only an admin can move videos to Trash.'}
            onClick={() => setConfirmTrash(true)}
          >
            Move to Trash
          </Button>
          <Button variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      <div className="adm-card adm-table-card" aria-busy={pending || undefined}>
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
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(ids))}
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
                  const isSel = selected.has(video.id);
                  return (
                    <tr key={video.id} className={isSel ? 'is-selected' : undefined}>
                      <td className="adm-table__check">
                        <Checkbox
                          label={`Select ${video.title}`}
                          checked={isSel}
                          onChange={() => toggle(video.id)}
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
                  className={`adm-vcard${selected.has(video.id) ? ' is-selected' : ''}`}
                >
                  <Checkbox
                    label={`Select ${video.title}`}
                    checked={selected.has(video.id)}
                    onChange={() => toggle(video.id)}
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
        open={confirmTrash}
        title={`Move ${selectedIds.length} ${selectedIds.length === 1 ? 'video' : 'videos'} to Trash?`}
        consequence="They stop showing to viewers right away. You can restore them for 30 days."
        confirmLabel="Move to Trash"
        danger
        busy={busy}
        onClose={() => setConfirmTrash(false)}
        onConfirm={() => run(selectedIds, { type: 'trash' }, 'Move to Trash')}
      />
    </div>
  );
}
