'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  DEFAULT_SERIES_LABELS,
  groupWord,
  itemCount,
  itemInSentence,
  itemWord,
  resolveSeriesLabels,
  validateSeriesLabels,
  type SeriesLabelSetting,
  type SeriesWords,
} from '@ad/shared/series-labels';
import type { SeriesPatch } from '@/lib/data/admin/collection-commands';
import type { SeriesDetail } from '@/lib/data/admin/services';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { useMaturityLabels } from '@/lib/maturity-context';
import { Badge } from './Badge';
import { Button } from './Button';
import { ConfirmDialog } from './Dialog';
import { SelectField, Switch, TextArea, TextField } from './fields';
import { EmptyState } from './states';
import { useCommand } from './useCommand';
import { SeriesNamesFields } from './site/SeriesNamesFields';

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
  const words = resolveSeriesLabels(series.labels, null);
  const some = itemInSentence(words, 2);
  const one = itemInSentence(words, 1);
  const [title, setTitle] = useState(series.title);
  const [description, setDescription] = useState(series.description);
  const [error, setError] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const [addId, setAddId] = useState('');
  const labels = useMaturityLabels();
  const savedRank = series.maturityRank ?? null;
  const [rank, setRank] = useState(savedRank === null ? '' : String(savedRank));
  const [applyOpen, setApplyOpen] = useState(false);
  const dirty =
    title !== series.title ||
    description !== series.description ||
    rank !== (savedRank === null ? '' : String(savedRank));
  const applying = rank === '' ? null : Number(rank);
  const differing = episodes.filter((v) => (v.maturityRank ?? null) !== applying);
  const differingRanks = new Set(differing.map((v) => v.maturityRank ?? null));
  const differingText =
    differing.length === 0
      ? `every ${one} already has this rating`
      : differingRanks.size === 1 && !differingRanks.has(null)
        ? `including ${differing.length} that ${differing.length === 1 ? 'is' : 'are'} rated ${labels[[...differingRanks][0]!]} today`
        : `including ${differing.length} that ${differing.length === 1 ? 'is' : 'are'} rated differently today`;

  async function save() {
    const result = await run(
      () =>
        actions.update(series.id, {
          title,
          description,
          ...(applying !== null && applying !== savedRank ? { maturityRank: applying } : {}),
        }),
      'Series saved.',
    );
    setError(result.ok ? undefined : result.error);
  }
  async function saveNames(labels: SeriesLabelSetting | null) {
    const result = await run(
      () => actions.update(series.id, { labels }),
      labels === null ? 'This series follows the site names.' : 'Series names saved.',
    );
    return result;
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
        <SelectField
          label="Maturity rating (required)"
          hint={`${itemWord(words, 2)} keep their own rating. A profile sees only the ${some} within its limit.`}
          value={rank}
          disabled={!canManage}
          options={[
            { value: '', label: 'Choose a rating' },
            ...labels.map((label, index) => ({ value: String(index), label })),
          ]}
          onChange={(e) => setRank(e.target.value)}
        />
        {savedRank !== null && rank === String(savedRank) && episodes.length > 0 ? (
          <div>
            <Button
              variant="secondary"
              disabled={!canManage || busy}
              onClick={() => setApplyOpen(true)}
            >
              {`Apply to all ${itemCount(words, episodes.length)}`}
            </Button>
          </div>
        ) : null}
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

      <SeriesNamesSection series={series} canManage={canManage} busy={busy} onSave={saveNames} />

      <section className="adm-card adm-stack" aria-labelledby="series-items">
        <h2 className="adm-h3" id="series-items">
          {itemWord(words, 2)}
        </h2>
        {episodes.length === 0 ? (
          <EmptyState
            title={`No ${some} yet.`}
            help={`Add a video below to make the first ${one}.`}
            icon="video"
          />
        ) : (
          <ol className="adm-list">
            {episodes.map((v) => (
              <EpisodeRow
                key={v.id}
                words={words}
                title={v.title}
                published={v.publishState === 'published'}
                season={v.seasonNumber}
                episode={v.episodeNumber}
                disabled={!canManage || busy}
                onSave={(s, e) =>
                  run(() => actions.setEpisode(v.id, series.id, s, e), 'Numbers saved.')
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
                `${itemWord(words, 1)} added.`,
              );
              setAddId('');
            }}
          >
            {`Add ${one}`}
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
        open={applyOpen && applying !== null}
        title={`Apply ${applying === null ? '' : labels[applying]} to all ${itemCount(words, episodes.length)}?`}
        consequence={`This replaces the rating on every ${one}, ${differingText}. You can change single ${some} later.`}
        confirmLabel={`Apply to ${itemCount(words, episodes.length)}`}
        cancelLabel={`Keep ${one} ratings`}
        busy={busy}
        onClose={() => setApplyOpen(false)}
        onConfirm={async () => {
          const result = await run(
            () => actions.update(series.id, { maturityRank: applying!, applyToEpisodes: true }),
            `Rating applied to every ${one}.`,
          );
          setError(result.ok ? undefined : result.error);
          setApplyOpen(false);
        }}
      />

      <ConfirmDialog
        open={confirm}
        title={`Delete ${series.title}?`}
        consequence={`${itemCount(words, episodes.length)} ${episodes.length === 1 ? 'stays' : 'stay'} in your library, but ${episodes.length === 1 ? 'it' : 'they'} will not belong to a series.`}
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
  words,
  title,
  published,
  season,
  episode,
  disabled,
  onSave,
  onRemove,
}: {
  words: SeriesWords;
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
          label={groupWord(words, 1)}
          inputMode="numeric"
          value={s}
          disabled={disabled}
          onChange={(x) => setS(x.target.value)}
          style={{ width: '5rem' }}
        />
        <TextField
          label={itemWord(words, 1)}
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

/** M50-S02: this series uses the site names, or its own set. */
function SeriesNamesSection({
  series,
  canManage,
  busy,
  onSave,
}: {
  series: SeriesDetail['series'];
  canManage: boolean;
  busy: boolean;
  onSave: (labels: SeriesLabelSetting | null) => Promise<CommandResult>;
}) {
  const own = series.labelOverride ?? null;
  const [useOwn, setUseOwn] = useState(own !== null);
  const [value, setValue] = useState<SeriesLabelSetting>(
    own ?? series.labels ?? DEFAULT_SERIES_LABELS,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>();

  async function save() {
    if (useOwn) {
      const checked = validateSeriesLabels(value);
      if (!checked.ok) {
        setErrors(checked.errors);
        return;
      }
    }
    setErrors({});
    const result = await onSave(useOwn ? value : null);
    setFailure(result.ok ? undefined : result.error);
  }

  return (
    <section className="adm-card adm-stack" aria-labelledby="series-names">
      <h2 className="adm-h3" id="series-names">
        Names for groups and items
      </h2>
      <fieldset
        className="adm-stack"
        disabled={!canManage}
        style={{ border: 0, padding: 0, margin: 0 }}
      >
        <legend className="adm-field__label">Which names does this series use?</legend>
        <label className="adm-check">
          <input
            type="radio"
            name="series-names-mode"
            checked={!useOwn}
            onChange={() => setUseOwn(false)}
          />
          <span>Use the site names</span>
        </label>
        <label className="adm-check">
          <input
            type="radio"
            name="series-names-mode"
            checked={useOwn}
            onChange={() => setUseOwn(true)}
          />
          <span>Use names for this series only</span>
        </label>
      </fieldset>
      {useOwn ? (
        <SeriesNamesFields
          value={value}
          errors={errors}
          onChange={(next) => {
            setErrors({});
            setValue(next);
          }}
        />
      ) : null}
      {failure ? (
        <p className="adm-field__error" role="alert">
          {failure}
        </p>
      ) : null}
      <div>
        <Button disabled={!canManage || busy} onClick={() => void save()}>
          Save names
        </Button>
      </div>
    </section>
  );
}
