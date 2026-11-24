'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ADD_TYPE_HINTS,
  ADD_TYPE_LABELS,
  addRow,
  launchHome,
  resolvePreview,
  setHero,
  validateConfig,
  MAX_HERO,
  MAX_ROWS,
  MAX_ROW_NAME,
} from '@/lib/data/admin/home-rules';
import type { HomeConfig, HomeRowType, HomeState } from '@/lib/data/admin/home-rules';
import type { CategoryRecord, SeriesRecord, VideoRecord } from '@/lib/data/admin/types';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { Badge } from './Badge';
import { Button } from './Button';
import { ConfirmDialog, Dialog } from './Dialog';
import { PosterTile, seedOf } from './PosterTile';
import { SelectField, Switch, TextField } from './fields';
import { HeroSlots } from './HeroSlots';
import { HomeSections } from './HomeSections';
import { SectionEditor } from './SectionEditor';
import { Banner } from './states';
import { Tabs } from './Tabs';
import { useCommand } from './useCommand';

export interface HomeActions {
  saveDraft(config: HomeConfig): Promise<CommandResult>;
  publish(config: HomeConfig): Promise<CommandResult>;
  restore(): Promise<CommandResult>;
}

let counter = 0;
const newId = () => `row_${Date.now().toString(36)}${++counter}`;
const ADDABLE = ['manual', 'category', 'newest', 'smart', 'series', 'each_category', 'all_series'] as const;
const DEFAULT_NAMES: Partial<Record<HomeRowType, string>> = {
  manual: 'New list',
  newest: 'New',
  smart: 'Trending',
  each_category: 'Browse by subject',
  all_series: 'Series',
};
const same = (a: HomeConfig, b: HomeConfig) => JSON.stringify(a) === JSON.stringify(b);

export function HomeCuration({
  state,
  videos,
  series,
  categories,
  canCurate,
  actions,
}: {
  state: HomeState;
  videos: VideoRecord[];
  series: SeriesRecord[];
  categories: CategoryRecord[];
  canCurate: boolean;
  actions: HomeActions;
}) {
  const router = useRouter();
  const { run, busy } = useCommand();
  const [config, setConfig] = useState<HomeConfig>(state.draft);
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState('desktop');
  const [kids, setKids] = useState(false);
  const [message, setMessage] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [newType, setNewType] = useState<HomeRowType>('manual');
  const [newName, setNewName] = useState('');
  const [newSource, setNewSource] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [addError, setAddError] = useState<string>();
  const [retry, setRetry] = useState<(() => Promise<unknown>) | null>(null);

  const sourceName =
    newType === 'category'
      ? categories.find((c) => c.id === newSource)?.name
      : newType === 'series'
        ? series.find((x) => x.id === newSource)?.title
        : undefined;
  const effectiveName = nameTouched ? newName : (sourceName ?? DEFAULT_NAMES[newType] ?? '');
  const dirty = !same(config, state.draft);
  const unpublished = !same(config, state.published);
  const preview = useMemo(
    () => resolvePreview(config, videos, series, kids),
    [config, videos, series, kids],
  );
  const sources = useMemo(() => ({ categories, series }), [categories, series]);
  const invalid = validateConfig(config);
  const selectedRow = config.rows.find((r) => r.id === selected) ?? null;
  const byId = new Map(videos.map((v) => [v.id, v]));
  const eligible = videos.filter((v) => v.publishState === 'published');

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const apply = (result: { ok: true; config: HomeConfig } | { ok: false; error: string }) => {
    if (result.ok) {
      setConfig(result.config);
      setMessage(undefined);
    } else setMessage(result.error);
    return result.ok;
  };

  /** Runs a save. A failure keeps every edit on screen and offers Retry (M17-S02 Error). */
  const attempt = async (work: () => Promise<CommandResult>, done: string) => {
    const go = async () => {
      const result = await run(work, done);
      setRetry(result.ok ? null : () => go);
      return result;
    };
    await go();
  };

  return (
    <div className="adm-stack">
      <div className="adm-toolbar" role="toolbar" aria-label="Home curation">
        <span className="adm-muted" role="status">
          {dirty
            ? 'Unsaved changes'
            : unpublished
              ? 'Saved draft, not published'
              : 'Published and up to date'}
        </span>
        <span className="adm-top__space" />
        <Button disabled={!canCurate || busy} onClick={() => setLaunching(true)}>
          Restore launch defaults
        </Button>
        <Button disabled={!canCurate || !state.previous || busy} onClick={() => setRestoring(true)}>
          Restore previous
        </Button>
        <Button
          disabled={!canCurate || !dirty || busy}
          loading={busy}
          onClick={() => attempt(() => actions.saveDraft(config), 'Draft saved.')}
        >
          Save draft
        </Button>
        <Button
          variant="primary"
          disabled={!canCurate || (!dirty && !unpublished) || busy || invalid !== null}
          onClick={() => attempt(() => actions.publish(config), 'Home page published.')}
        >
          Publish changes
        </Button>
      </div>
      {message ? <Banner tone="danger">{message}</Banner> : null}
      {retry ? (
        <Banner
          tone="danger"
          action={
            <Button disabled={busy} onClick={() => void retry()}>
              Retry
            </Button>
          }
        >
          <strong>We could not save your changes.</strong>
          <p style={{ margin: 0 }}>Your edits are still here. Check your connection and try again.</p>
        </Banner>
      ) : null}
      {invalid ? <Banner tone="warning">{invalid}. Fix this before you publish.</Banner> : null}

      <div className="adm-review">
        <div className="adm-stack">
          <section className="adm-card adm-stack" aria-labelledby="hero-slots">
            <h2 className="adm-h3" id="hero-slots">
              Hero titles
            </h2>
            <p className="adm-muted" style={{ margin: 0 }}>
              Up to {MAX_HERO}. They rotate at the top of Home.
            </p>
            {config.heroIds.length === 0 ? (
              <p className="adm-muted" style={{ margin: 0 }}>
                No hero titles chosen. Home shows your 5 newest titles.
              </p>
            ) : (
              <ol className="adm-list">
                {config.heroIds.map((id, i) => {
                  const v = byId.get(id);
                  return (
                    <li key={id}>
                      <span>
                        {v?.title ?? 'Removed video'}
                        {v && v.publishState !== 'published' ? (
                          <>
                            {' '}
                            <Badge tone="warning" icon="alert">
                              Not published, skipped
                            </Badge>
                          </>
                        ) : null}
                      </span>
                      <span className="adm-row">
                        <Button
                          variant="ghost"
                          icon="up"
                          aria-label={`Move ${v?.title ?? 'title'} up in hero`}
                          disabled={!canCurate || i === 0}
                          onClick={() => {
                            const ids = [...config.heroIds];
                            [ids[i - 1], ids[i]] = [ids[i]!, ids[i - 1]!];
                            apply(setHero(config, ids));
                          }}
                        />
                        <Button
                          variant="ghost"
                          aria-label={`Remove ${v?.title ?? 'title'} from hero`}
                          disabled={!canCurate}
                          onClick={() =>
                            apply(
                              setHero(
                                config,
                                config.heroIds.filter((x) => x !== id),
                              ),
                            )
                          }
                        >
                          Remove
                        </Button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            <HeroSlots config={config} videos={videos} canCurate={canCurate} onChange={(next) => apply({ ok: true, config: next })} />
            <div className="adm-row">
              <SelectField
                label="Add hero title"
                value=""
                disabled={!canCurate || config.heroIds.length >= MAX_HERO}
                onChange={(e) =>
                  e.target.value && apply(setHero(config, [...config.heroIds, e.target.value]))
                }
                options={[
                  {
                    value: '',
                    label:
                      config.heroIds.length >= MAX_HERO ? 'Hero slots are full' : 'Choose a title',
                  },
                  ...eligible
                    .filter((v) => !config.heroIds.includes(v.id))
                    .map((v) => ({ value: v.id, label: v.title })),
                ]}
              />
            </div>
          </section>

          <HomeSections
            config={config}
            selectedId={selected}
            sources={sources}
            canCurate={canCurate}
            onSelect={setSelected}
            onChange={setConfig}
            onRestoreDefaults={() => setLaunching(true)}
            onAdd={() => {
              if (config.rows.length >= MAX_ROWS) {
                setMessage(
                  `Home can hold ${MAX_ROWS} sections. Hide or remove one to add another. Each category (automatic) counts as one.`,
                );
                return;
              }
              setMessage(undefined);
              setAdding(true);
            }}
          />

          {selectedRow ? (
            <SectionEditor
              config={config}
              row={selectedRow}
              sources={sources}
              titles={{ byId, eligible }}
              canCurate={canCurate}
              onChange={setConfig}
              onError={setMessage}
              onRemoved={() => setSelected(null)}
            />
          ) : null}
        </div>

        <section className="adm-card adm-stack" aria-labelledby="home-preview">
          <div className="adm-row" style={{ justifyContent: 'space-between' }}>
            <h2 className="adm-h3" id="home-preview">
              Live preview
            </h2>
            <Switch label="Kids view" checked={kids} onChange={setKids} />
          </div>
          <Tabs
            label="Preview size"
            value={device}
            onChange={setDevice}
            tabs={[
              { id: 'desktop', label: 'Desktop' },
              { id: 'mobile', label: 'Mobile' },
            ]}
          >
            <div
              className={`adm-preview adm-preview--${device}`}
              aria-label={`Home preview, ${device}`}
            >
              {preview.hero.length ? (
                <div className="adm-preview__hero">
                  <strong>{preview.hero[0]!.title}</strong>
                  {preview.hero.length > 1 ? (
                    <span className="adm-muted"> and {preview.hero.length - 1} more rotating</span>
                  ) : null}
                </div>
              ) : (
                <p className="adm-muted">Nothing to preview yet.</p>
              )}
              {preview.heroFallback && preview.hero.length ? (
                <p className="adm-muted">Newest titles are used until you choose hero titles.</p>
              ) : null}
              {preview.skippedHero.length ? (
                <Banner tone="warning">
                  {preview.skippedHero.length} hero{' '}
                  {preview.skippedHero.length === 1 ? 'title is' : 'titles are'} not published and
                  will be skipped.
                </Banner>
              ) : null}
              {preview.rows.map((r) => (
                <div key={r.id} className="adm-preview__row">
                  <h3 className="adm-h3">{r.name}</h3>
                  {r.skipped.length ? (
                    <p className="adm-muted" style={{ margin: 0 }}>
                      <Badge tone="warning" icon="alert">
                        {r.skipped.length} skipped
                      </Badge>{' '}
                      not published yet
                    </p>
                  ) : null}
                  {r.type === 'continue_watching' || r.type === 'my_list' ? (
                    <p className="adm-muted" style={{ margin: 0 }}>
                      Each viewer sees their own titles here.
                    </p>
                  ) : r.empty ? (
                    <p className="adm-muted" style={{ margin: 0 }}>
                      Nothing to show yet. Viewers will not see this row.
                    </p>
                  ) : (
                    <ul className="adm-preview__tiles">
                      {r.items.slice(0, device === 'mobile' ? 3 : 6).map((v) => (
                        <li key={v.id}>
                          <PosterTile title={v.title} seed={seedOf(v.id)} />
                          <span>{v.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Tabs>
        </section>
      </div>

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a section"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if ((newType === 'category' || newType === 'series') && !newSource)
                  return setAddError(newType === 'category' ? 'Choose a category.' : 'Choose a series.');
                const r = addRow(config, newType, effectiveName, newSource || null, newId);
                if (!r.ok) return setAddError(r.error);
                setConfig(r.config);
                setMessage(undefined);
                setAdding(false);
                setNameTouched(false);
                setNewSource('');
                setSelected(r.config.rows.at(-1)!.id);
              }}
            >
              Add section
            </Button>
          </>
        }
      >
        <fieldset className="adm-viewall" aria-label="What kind of section?">
          <legend className="adm-field__label">What kind of section?</legend>
          {ADDABLE.map((t) => (
            <label key={t} className={`adm-viewall__opt${newType === t ? ' is-on' : ''}`}>
              <input
                type="radio"
                name="section-type"
                checked={newType === t}
                onChange={() => {
                  setNewType(t);
                  setNewSource('');
                  setAddError(undefined);
                }}
              />
              <span>
                <strong>{ADD_TYPE_LABELS[t]}</strong>
                <span className="adm-muted">{ADD_TYPE_HINTS[t]}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {newType === 'category' ? (
          <SelectField
            label="Category"
            value={newSource}
            onChange={(e) => {
              setNewSource(e.target.value);
              setAddError(undefined);
            }}
            options={[
              { value: '', label: 'Choose a category' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        ) : null}
        {newType === 'series' ? (
          <SelectField
            label="Series"
            value={newSource}
            onChange={(e) => {
              setNewSource(e.target.value);
              setAddError(undefined);
            }}
            options={[
              { value: '', label: 'Choose a series' },
              ...series.map((s) => ({ value: s.id, label: s.title })),
            ]}
          />
        ) : null}
        <TextField
          label="Section name"
          value={effectiveName}
          maxLength={MAX_ROW_NAME + 20}
          aside={`${effectiveName.trim().length} of ${MAX_ROW_NAME}`}
          onChange={(e) => {
            setNewName(e.target.value);
            setNameTouched(true);
            setAddError(undefined);
          }}
        />
        {addError ? (
          <p className="adm-field__error" role="alert">
            {addError}
          </p>
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={launching}
        title="Restore the launch sections?"
        consequence="Your sections and their order are replaced by the launch set. Titles stay in your library. Nothing changes for viewers until you publish, and Restore previous still works."
        confirmLabel="Restore launch defaults"
        onClose={() => setLaunching(false)}
        onConfirm={() => {
          setConfig({ ...launchHome(), heroIds: config.heroIds });
          setSelected(null);
          setMessage(undefined);
          setLaunching(false);
        }}
      />
      <ConfirmDialog
        open={restoring}
        title="Restore the previous Home page?"
        consequence="Home goes back to the version before your last publish. Your current version is kept so you can switch back."
        confirmLabel="Restore previous"
        busy={busy}
        onClose={() => setRestoring(false)}
        onConfirm={async () => {
          const r = await run(() => actions.restore(), 'Previous version restored.');
          setRestoring(false);
          if (r.ok) router.refresh();
        }}
      />
    </div>
  );
}
