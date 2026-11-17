'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ROW_TYPE_LABELS,
  addRow,
  addTitle,
  isFixed,
  moveRow,
  moveTitle,
  removeRow,
  removeTitle,
  renameRow,
  resolvePreview,
  setHero,
  toggleRow,
  MAX_HERO,
  MAX_ROWS,
} from '@/lib/data/admin/home-rules';
import type { HomeConfig, HomeRowType, HomeState } from '@/lib/data/admin/home-rules';
import type { CategoryRecord, SeriesRecord, VideoRecord } from '@/lib/data/admin/types';
import type { CommandResult } from '@/lib/data/admin/video-commands';
import { Badge } from './Badge';
import { Button } from './Button';
import { ConfirmDialog, Dialog } from './Dialog';
import { PosterTile, seedOf } from './PosterTile';
import { SelectField, Switch, TextField } from './fields';
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
  const [newType, setNewType] = useState<HomeRowType>('manual');
  const [newName, setNewName] = useState('');
  const [newSource, setNewSource] = useState('');
  const [pick, setPick] = useState('');

  const dirty = !same(config, state.draft);
  const unpublished = !same(config, state.published);
  const preview = useMemo(
    () => resolvePreview(config, videos, series, kids),
    [config, videos, series, kids],
  );
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
        <Button disabled={!canCurate || !state.previous || busy} onClick={() => setRestoring(true)}>
          Restore previous
        </Button>
        <Button
          disabled={!canCurate || !dirty || busy}
          loading={busy}
          onClick={() => run(() => actions.saveDraft(config), 'Draft saved.')}
        >
          Save draft
        </Button>
        <Button
          variant="primary"
          disabled={!canCurate || (!dirty && !unpublished) || busy}
          onClick={() => run(() => actions.publish(config), 'Home page published.')}
        >
          Publish changes
        </Button>
      </div>
      {message ? <Banner tone="danger">{message}</Banner> : null}

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
                No hero title yet. Home shows no banner.
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

          <section className="adm-card adm-stack" aria-labelledby="home-rows">
            <div className="adm-row" style={{ justifyContent: 'space-between' }}>
              <h2 className="adm-h3" id="home-rows">
                Rows
              </h2>
              <Button
                icon="plus"
                disabled={!canCurate || config.rows.length >= MAX_ROWS}
                onClick={() => {
                  setMessage(undefined);
                  setAdding(true);
                }}
              >
                Add row
              </Button>
            </div>
            {config.rows.length >= MAX_ROWS ? (
              <Banner tone="info">
                Row limit reached ({MAX_ROWS}). Remove a row to add another.
              </Banner>
            ) : null}
            <ol className="adm-list" aria-label="Rows in the order viewers see them">
              {config.rows.map((r, i) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="adm-linkbtn"
                    aria-pressed={selected === r.id}
                    onClick={() => setSelected(selected === r.id ? null : r.id)}
                  >
                    <strong>{r.name}</strong>{' '}
                    <span className="adm-muted">
                      {ROW_TYPE_LABELS[r.type]}
                      {r.type === 'manual' ? `, ${r.videoIds.length} titles` : ''}
                    </span>
                  </button>
                  <span className="adm-row">
                    <Button
                      variant="ghost"
                      icon="up"
                      aria-label={`Move ${r.name} up`}
                      disabled={!canCurate || i === 0}
                      onClick={() => setConfig(moveRow(config, r.id, -1))}
                    />
                    <Button
                      variant="ghost"
                      icon="down"
                      aria-label={`Move ${r.name} down`}
                      disabled={!canCurate || i === config.rows.length - 1}
                      onClick={() => setConfig(moveRow(config, r.id, 1))}
                    />
                    <Switch
                      label={`Show ${r.name}`}
                      checked={r.visible}
                      disabled={!canCurate}
                      onChange={() => setConfig(toggleRow(config, r.id))}
                    />
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {selectedRow ? (
            <section className="adm-card adm-stack" aria-labelledby="row-editor">
              <h2 className="adm-h3" id="row-editor">
                Edit row: {selectedRow.name}
              </h2>
              <TextField
                label="Row name"
                value={selectedRow.name}
                disabled={!canCurate}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    rows: config.rows.map((r) =>
                      r.id === selectedRow.id ? { ...r, name: e.target.value } : r,
                    ),
                  })
                }
                onBlur={(e) => {
                  if (!e.target.value.trim())
                    apply(renameRow(config, selectedRow.id, e.target.value));
                }}
              />
              {selectedRow.type === 'manual' ? (
                <>
                  <ol className="adm-list">
                    {selectedRow.videoIds.map((id, i) => {
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
                              aria-label={`Move ${v?.title ?? 'title'} up`}
                              disabled={!canCurate || i === 0}
                              onClick={() => setConfig(moveTitle(config, selectedRow.id, id, -1))}
                            />
                            <Button
                              variant="ghost"
                              icon="down"
                              aria-label={`Move ${v?.title ?? 'title'} down`}
                              disabled={!canCurate || i === selectedRow.videoIds.length - 1}
                              onClick={() => setConfig(moveTitle(config, selectedRow.id, id, 1))}
                            />
                            <Button
                              variant="ghost"
                              aria-label={`Remove ${v?.title ?? 'title'} from row`}
                              disabled={!canCurate}
                              onClick={() => setConfig(removeTitle(config, selectedRow.id, id))}
                            >
                              Remove
                            </Button>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  <div className="adm-row">
                    <SelectField
                      label="Add title"
                      value={pick}
                      disabled={!canCurate}
                      onChange={(e) => setPick(e.target.value)}
                      options={[
                        { value: '', label: 'Choose a title' },
                        ...eligible
                          .filter((v) => !selectedRow.videoIds.includes(v.id))
                          .map((v) => ({ value: v.id, label: v.title })),
                      ]}
                    />
                    <Button
                      disabled={!pick || !canCurate}
                      onClick={() => {
                        if (apply(addTitle(config, selectedRow.id, pick))) setPick('');
                      }}
                    >
                      Add to row
                    </Button>
                  </div>
                </>
              ) : (
                <p className="adm-muted" style={{ margin: 0 }}>
                  {isFixed(selectedRow)
                    ? 'This row is built in. You can move it or hide it.'
                    : 'This row fills itself from your library.'}
                </p>
              )}
              {!isFixed(selectedRow) ? (
                <div>
                  <Button
                    variant="danger"
                    disabled={!canCurate}
                    onClick={() => {
                      if (apply(removeRow(config, selectedRow.id))) setSelected(null);
                    }}
                  >
                    Remove row
                  </Button>
                </div>
              ) : null}
            </section>
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
                <p className="adm-muted">No hero banner.</p>
              )}
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
        title="Add a row"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const r = addRow(config, newType, newName, newSource || null, newId);
                if (apply(r)) {
                  setAdding(false);
                  setNewName('');
                  if (r.ok) setSelected(r.config.rows.at(-1)!.id);
                }
              }}
            >
              Add row
            </Button>
          </>
        }
      >
        <SelectField
          label="Type"
          value={newType}
          onChange={(e) => setNewType(e.target.value as HomeRowType)}
          options={(['manual', 'category', 'newest', 'series', 'smart'] as const).map((t) => ({
            value: t,
            label: ROW_TYPE_LABELS[t],
          }))}
        />
        <TextField
          label="Row name"
          value={newName}
          maxLength={60}
          onChange={(e) => setNewName(e.target.value)}
        />
        {newType === 'category' ? (
          <SelectField
            label="Category"
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
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
            onChange={(e) => setNewSource(e.target.value)}
            options={[
              { value: '', label: 'Choose a series' },
              ...series.map((s) => ({ value: s.id, label: s.title })),
            ]}
          />
        ) : null}
      </Dialog>
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
