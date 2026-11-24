'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SeriesPatch } from '@/lib/data/admin/collection-commands';
import type { SeriesDetail } from '@/lib/data/admin/services';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { Badge } from './Badge';
import { Button } from './Button';
import { ConfirmDialog } from './Dialog';
import { SelectField, Switch, TextArea, TextField } from './fields';
import { EmptyState } from './states';
import { useCommand } from './useCommand';

export interface SeriesActions {
  update(id: string, patch: SeriesPatch): Promise<CommandResult>;
  remove(id: string): Promise<CommandResult>;
  setEpisode(
    videoId: string,
    seriesId: string | null,
    season: number | null,
    episode: number | null,
  ): Promise<CommandResult>;
}

export function SeriesEditor({
  detail,
  canManage,
  canDelete = true,
  actions,
}: {
  detail: SeriesDetail;
  canManage: boolean;
  /** Only an admin can delete a series (series.delete). */
  canDelete?: boolean;
  actions: SeriesActions;
}) {
  const router = useRouter();
  const { run, busy } = useCommand();
  const { series, episodes, available } = detail;
  const [title, setTitle] = useState(series.title);
  const [description, setDescription] = useState(series.description);
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const [addId, setAddId] = useState('');
  const dirty = title !== series.title || description !== series.description;

  async function save() {
    const result = await run(
      () => actions.update(series.id, { title, description }),
      'Series saved.',
    );
    setError(result.ok ? undefined : result.error);
  }
  async function publish(next: boolean) {
    const result = await run(
      () => actions.update(series.id, { published: next }),
      next ? 'Series published.' : 'Series is a draft again.',
    );
    setError(result.ok ? undefined : result.error);
  }

  return (
    <div className="adm-stack">
      <section className="adm-card adm-stack" aria-labelledby="series-details">
        <h2 className="adm-h3" id="series-details">
          Details
        </h2>
        <TextField
          label="Title"
          value={title}
          maxLength={80}
          disabled={!canManage}
          onChange={(e) => setTitle(e.target.value)}
          error={error}
        />
        <TextArea
          label="Description"
          value={description}
          maxLength={500}
          disabled={!canManage}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="adm-row">
          <Button variant="primary" loading={busy} disabled={!canManage || !dirty} onClick={save}>
            Save changes
          </Button>
          <Switch
            label="Published"
            checked={series.published}
            disabled={!canManage || busy}
            onChange={(value) => void publish(value)}
          />
        </div>
      </section>

      <section className="adm-card adm-stack" aria-labelledby="series-episodes">
        <h2 className="adm-h3" id="series-episodes">
          Episodes
        </h2>
        {episodes.length === 0 ? (
          <EmptyState
            title="No episodes yet."
            help="Add a video below to make the first episode."
            icon="video"
          />
        ) : (
          <ol className="adm-list">
            {episodes.map((v) => (
              <EpisodeRow
                key={v.id}
                title={v.title}
                published={v.publishState === 'published'}
                season={v.seasonNumber}
                episode={v.episodeNumber}
                disabled={!canManage || busy}
                onSave={(s, e) =>
                  run(() => actions.setEpisode(v.id, series.id, s, e), 'Episode numbers saved.')
                }
                onRemove={() =>
                  run(() => actions.setEpisode(v.id, null, null, null), 'Removed from the series.')
                }
              />
            ))}
          </ol>
        )}
        <div className="adm-row">
          <SelectField
            label="Add a video"
            value={addId}
            disabled={!canManage || available.length === 0}
            onChange={(e) => setAddId(e.target.value)}
            options={[
              { value: '', label: available.length ? 'Choose a video' : 'No unassigned videos' },
              ...available.map((v) => ({ value: v.id, label: v.title })),
            ]}
          />
          <Button
            disabled={!addId || busy}
            onClick={async () => {
              await run(
                () => actions.setEpisode(addId, series.id, 1, episodes.length + 1),
                'Episode added.',
              );
              setAddId('');
            }}
          >
            Add episode
          </Button>
        </div>
      </section>

      <section className="adm-card adm-stack" aria-labelledby="series-danger">
        <h2 className="adm-h3" id="series-danger">
          Delete series
        </h2>
        <p className="adm-muted" style={{ margin: 0 }}>
          The videos stay in your library. They are only removed from this series.
        </p>
        <div>
          <Button
            variant="danger"
            disabled={!canManage}
            disabledReason={canDelete ? undefined : 'Only an admin can delete a series.'}
            onClick={() => setConfirm(true)}
          >
            Delete series
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={confirm}
        title={`Delete ${series.title}?`}
        consequence={`${episodes.length} ${episodes.length === 1 ? 'episode stays' : 'episodes stay'} in your library, but they will not belong to a series.`}
        confirmLabel="Delete series"
        danger
        busy={busy}
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          const r = await run(() => actions.remove(series.id), 'Series deleted.');
          setConfirm(false);
          if (r.ok) router.push('/admin/series');
        }}
      />
    </div>
  );
}

function EpisodeRow({
  title,
  published,
  season,
  episode,
  disabled,
  onSave,
  onRemove,
}: {
  title: string;
  published: boolean;
  season: number | null;
  episode: number | null;
  disabled: boolean;
  onSave: (s: number | null, e: number | null) => void;
  onRemove: () => void;
}) {
  const [s, setS] = useState(String(season ?? 1));
  const [e, setE] = useState(String(episode ?? ''));
  const num = (v: string) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
  return (
    <li className="adm-listrow">
      <div className="adm-listrow__main">
        <strong>{title}</strong>
        <Badge tone={published ? 'success' : 'neutral'}>
          {published ? 'Published' : 'Not published'}
        </Badge>
      </div>
      <div className="adm-row">
        <TextField
          label="Season"
          inputMode="numeric"
          value={s}
          disabled={disabled}
          onChange={(x) => setS(x.target.value)}
          style={{ width: '5rem' }}
        />
        <TextField
          label="Episode"
          inputMode="numeric"
          value={e}
          disabled={disabled}
          onChange={(x) => setE(x.target.value)}
          style={{ width: '5rem' }}
        />
        <Button
          disabled={disabled}
          aria-label={`Save numbers for ${title}`}
          onClick={() => onSave(num(s), num(e))}
        >
          Save
        </Button>
        <Button
          variant="ghost"
          disabled={disabled}
          aria-label={`Remove ${title} from the series`}
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}
