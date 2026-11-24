'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { AccountRole } from '@ad/shared';
import { can } from '@/lib/admin/can';
import { formatDuration } from '@/lib/admin/format';
import { formatBytes } from '@/lib/uploader/format';
import type {
  CategoryRecord,
  SeriesRecord,
  Suitability,
  VideoRecord,
} from '@/lib/data/admin/types';
import type { BulkAction, BulkResult } from '@/lib/data/admin/video-queries';
import type { CommandResult, PublishRequest, VideoPatch } from '@/lib/data/admin/video-commands';
import { adminStatusOf, publishChecklist } from '@/lib/data/admin/video-rules';
import { StatusBadge } from './Badge';
import { Button, LinkButton } from './Button';
import { Checklist } from './ChecklistCard';
import { ConfirmDialog } from './Dialog';
import { Checkbox, SelectField, TextArea, TextField } from './fields';
import { Card } from './PageHeader';
import { PosterTile, seedOf } from './PosterTile';
import { PublishDialog } from './PublishDialog';
import { Banner } from './states';
import { useToast } from './Toast';

export type UpdateResult = { ok: true } | { ok: false; errors: Record<string, string> };

export interface EditorActions {
  update(patch: VideoPatch): Promise<UpdateResult>;
  publish(request: PublishRequest): Promise<CommandResult>;
  unpublish(): Promise<CommandResult>;
  retryEncode(): Promise<CommandResult>;
  bulk(action: BulkAction): Promise<BulkResult>;
}

interface Props {
  video: VideoRecord;
  categories: CategoryRecord[];
  series: SeriesRecord[];
  role: AccountRole;
  actions: EditorActions;
  /** Where "Preview as viewer" goes. The viewer lane owns the route. */
  viewerHref: string;
  /** One line about the skip markers and chapters, or null when none are set (M43-S04). */
  markersSummary?: string | null;
}

interface FormState {
  title: string;
  slug: string;
  description: string;
  tags: string;
  categoryIds: string[];
  suitability: Suitability | '';
  seriesId: string;
  episodeNumber: string;
}

const toForm = (video: VideoRecord): FormState => ({
  title: video.title,
  slug: video.slug,
  description: video.description,
  tags: video.tags.join(', '),
  categoryIds: video.categoryIds,
  suitability: video.suitability ?? '',
  seriesId: video.seriesId ?? '',
  episodeNumber: video.episodeNumber ? String(video.episodeNumber) : '',
});

const same = (a: FormState, b: FormState) => JSON.stringify(a) === JSON.stringify(b);

export function VideoEditor({
  video,
  categories,
  series,
  role,
  actions,
  viewerHref,
  markersSummary = null,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState<FormState>(() => toForm(video));
  const [form, setForm] = useState<FormState>(saved);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const dirty = !same(form, saved);
  const status = adminStatusOf(video);
  const checklist = useMemo(() => publishChecklist(video), [video]);
  const done = checklist.filter((item) => item.done).length;
  const processing = status === 'processing' || status === 'uploading';

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setSaving(true);
    setErrors({});
    const episode = Number.parseInt(form.episodeNumber, 10);
    try {
      const result = await actions.update({
        title: form.title,
        slug: form.slug,
        description: form.description,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        categoryIds: form.categoryIds,
        suitability: form.suitability || null,
        seriesId: form.seriesId || null,
        episodeNumber: form.seriesId && Number.isFinite(episode) ? episode : null,
      });
      if (result.ok) {
        setSaved(form);
        toast.show({ tone: 'success', message: 'Changes saved.' });
        router.refresh();
      } else {
        setErrors(result.errors);
      }
    } catch {
      toast.show({
        tone: 'danger',
        message: 'Could not save. Your changes are still here. Try again.',
      });
    } finally {
      setSaving(false);
    }
  }

  const categoryNames = form.categoryIds
    .map((id) => categories.find((c) => c.id === id)?.name)
    .filter(Boolean);
  const publishReason = processing
    ? 'Wait until the video has finished preparing.'
    : status === 'failed'
      ? 'Retry encoding first.'
      : dirty
        ? 'Save your changes first.'
        : undefined;
  const canPublish = can(role, 'video.publish');
  const isPublished = video.publishState === 'published';

  return (
    <div className="adm-edit">
      <div className="adm-stack">
        {status === 'failed' ? (
          <Banner
            tone="danger"
            action={
              <Button
                variant="primary"
                icon="retry"
                loading={retrying}
                onClick={async () => {
                  setRetrying(true);
                  const result = await actions.retryEncode();
                  toast.show(
                    result.ok
                      ? { tone: 'success', message: 'Encoding started again.' }
                      : { tone: 'danger', message: result.error },
                  );
                  setRetrying(false);
                  router.refresh();
                }}
              >
                Retry encoding
              </Button>
            }
          >
            <strong>Encoding failed.</strong> {video.failure?.reason} The original file is safe.
          </Banner>
        ) : null}
        {processing ? (
          <Banner tone="info">
            This video is still being prepared. You can edit its details now. Publishing waits until
            it is ready.
          </Banner>
        ) : null}
        {dirty ? <Banner tone="warning">You have unsaved changes.</Banner> : null}

        <form
          className="adm-card adm-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          noValidate
        >
          <h2 className="adm-h3">Details</h2>
          <TextField
            label="Title"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            error={errors.title}
            maxLength={140}
            required
          />
          <TextField
            label="Address"
            hint="Shown in the link to this video. If you change it, the old address keeps working."
            value={form.slug}
            onChange={(e) => set('slug', e.target.value)}
            error={errors.slug}
            maxLength={120}
            autoCapitalize="none"
            spellCheck={false}
          />
          <TextArea
            label="Description"
            hint="Start with what viewers will learn."
            aside={`${form.description.length} / 500`}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            error={errors.description}
          />
          <fieldset className="adm-fieldset">
            <legend className="adm-field__label">Categories</legend>
            <div className="adm-row">
              {categories.map((category) => (
                <Checkbox
                  key={category.id}
                  label={category.name}
                  checked={form.categoryIds.includes(category.id)}
                  onChange={(e) =>
                    set(
                      'categoryIds',
                      e.target.checked
                        ? [...form.categoryIds, category.id]
                        : form.categoryIds.filter((id) => id !== category.id),
                    )
                  }
                />
              ))}
            </div>
            {errors.categoryIds ? (
              <p className="adm-field__error" role="alert">
                {errors.categoryIds}
              </p>
            ) : null}
          </fieldset>
          <TextField
            label="Tags"
            hint="Separate with commas. Up to 10."
            value={form.tags}
            onChange={(e) => set('tags', e.target.value)}
            error={errors.tags}
          />
          <SelectField
            label="Suitability"
            value={form.suitability}
            error={errors.suitability}
            options={[
              { value: '', label: 'Choose who it is for' },
              { value: 'everyone', label: 'Everyone' },
              { value: 'kids', label: 'Kids' },
              { value: 'older', label: 'Older viewers' },
            ]}
            onChange={(e) => set('suitability', e.target.value as FormState['suitability'])}
          />
          <div className="adm-grid-2">
            <SelectField
              label="Series"
              value={form.seriesId}
              options={[
                { value: '', label: 'Not in a series' },
                ...series.map((s) => ({ value: s.id, label: s.title })),
              ]}
              onChange={(e) => set('seriesId', e.target.value)}
            />
            <TextField
              label="Episode"
              type="number"
              inputMode="numeric"
              min={1}
              value={form.episodeNumber}
              disabled={!form.seriesId}
              onChange={(e) => set('episodeNumber', e.target.value)}
              error={errors.episodeNumber}
            />
          </div>
          <div className="adm-form-actions">
            <Button
              variant="ghost"
              disabled={!dirty || saving}
              onClick={() => {
                setForm(saved);
                setErrors({});
              }}
            >
              Discard changes
            </Button>
            <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </form>
      </div>

      <aside className="adm-stack" aria-label="Publishing">
        <Card
          title="Before you publish"
          aside={
            <span className="adm-muted">
              {done} of {checklist.length} done
            </span>
          }
        >
          <Checklist items={checklist} />
          <LinkButton href={`/admin/videos/${video.id}/poster`} variant="secondary" icon="image">
            {video.posterId ? 'Change poster' : 'Choose poster'}
          </LinkButton>
        </Card>

        <Card title="Skip and chapters">
          <p className="adm-list__sub">
            {markersSummary ?? 'Not set. Viewers cannot skip anything yet.'}
          </p>
          <LinkButton
            href={`/admin/videos/${video.id}/markers`}
            variant="secondary"
            aria-label={markersSummary ? 'Edit skip and chapters' : 'Set up skip and chapters'}
          >
            {markersSummary ? 'Edit' : 'Set up skip and chapters'}
          </LinkButton>
        </Card>

        <Card title="How viewers see it">
          <div className="adm-preview">
            <PosterTile title={form.title || video.title} seed={seedOf(video.id)} size="lg" />
            <span className="adm-preview__len">
              {video.durationSeconds ? formatDuration(video.durationSeconds) : ''}
            </span>
            {video.captionState === 'approved' ? <span className="adm-preview__cc">CC</span> : null}
          </div>
          <p className="adm-list__title">{form.title || 'Untitled video'}</p>
          <p className="adm-list__sub">
            {categoryNames.join(', ') || 'No category'},{' '}
            {Math.max(1, Math.round(video.durationSeconds / 60))} min
          </p>
          <p className="adm-muted" style={{ margin: 0 }}>
            <StatusBadge status={status} /> {video.sizeBytes ? formatBytes(video.sizeBytes) : ''}
          </p>
          {isPublished ? (
            <Button
              disabledReason={canPublish ? undefined : 'Your role cannot unpublish.'}
              onClick={() => setUnpublishOpen(true)}
            >
              Unpublish
            </Button>
          ) : (
            <Button
              variant="primary"
              disabledReason={!canPublish ? 'Your role cannot publish.' : publishReason}
              onClick={() => setPublishOpen(true)}
            >
              {video.publishState === 'scheduled' ? 'Change schedule' : 'Publish'}
            </Button>
          )}
          {!isPublished && checklist.some((i) => !i.done && i.key === 'captions') ? (
            <p className="adm-muted" style={{ margin: 0 }}>
              Approve the captions to publish. Admins can publish with a reason.
            </p>
          ) : null}
          <Link className="adm-link" href={viewerHref}>
            Preview as viewer
          </Link>
          <Button
            variant="danger"
            disabledReason={
              can(role, 'video.delete') ? undefined : 'Only an admin can move videos to Trash.'
            }
            onClick={() => setTrashOpen(true)}
          >
            Move to Trash
          </Button>
        </Card>
      </aside>

      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title={video.title}
        checklist={checklist}
        role={role}
        publish={actions.publish}
        onDone={(mode) => {
          setPublishOpen(false);
          toast.show({
            tone: 'success',
            message: mode === 'now' ? `${video.title} is live.` : `${video.title} is scheduled.`,
          });
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={unpublishOpen}
        title={`Unpublish ${video.title}?`}
        consequence="Viewers can no longer find or watch it. You can publish it again any time."
        confirmLabel="Unpublish"
        onClose={() => setUnpublishOpen(false)}
        onConfirm={async () => {
          const result = await actions.unpublish();
          setUnpublishOpen(false);
          toast.show(
            result.ok
              ? { tone: 'success', message: `${video.title} is unpublished.` }
              : { tone: 'danger', message: result.error },
          );
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={trashOpen}
        title={`Move ${video.title} to Trash?`}
        consequence="It stops showing to viewers right away. You can restore it for 30 days."
        confirmLabel="Move to Trash"
        danger
        onClose={() => setTrashOpen(false)}
        onConfirm={async () => {
          const result = await actions.bulk({ type: 'trash' });
          setTrashOpen(false);
          if (result.succeeded.length) router.push('/admin/videos');
          else
            toast.show({
              tone: 'danger',
              message: result.failed[0]?.reason ?? 'Could not move it to Trash.',
            });
        }}
      />
    </div>
  );
}
