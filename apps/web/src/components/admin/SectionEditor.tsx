'use client';

import { useState } from 'react';
import {
  MAX_ROW_NAME,
  ROW_TYPE_LABELS,
  defaultMinItems,
  duplicateNameNote,
  isFixed,
  removeRow,
  renameRow,
  setKidsVisible,
  setMinItems,
  viewAllOpens,
} from '@/lib/data/admin/home-rules';
import type { HomeConfig, HomeRow, SectionSources } from '@/lib/data/admin/home-rules';
import { Button } from './Button';
import { ConfirmDialog } from './Dialog';
import { Switch, TextField } from './fields';
import { ManualTitles, type TitleSources } from './ManualTitles';
import { ViewAllField } from './ViewAllField';

const hiddenWhile = (row: HomeRow, min: number) => {
  const base = min <= 1 ? 'Hidden while it has no titles.' : `Hidden while it has fewer than ${min} titles.`;
  return row.type === 'smart' ? `${base} Trending never fills itself with new videos.` : base;
};

/** The editor for one selected section: link, minimum titles, Kids visibility, titles and removal (M41-S07). */
export function SectionEditor({
  config,
  row,
  sources,
  titles,
  canCurate,
  onChange,
  onError,
  onRemoved,
}: {
  config: HomeConfig;
  row: HomeRow;
  sources: SectionSources;
  titles: TitleSources;
  canCurate: boolean;
  onChange: (config: HomeConfig) => void;
  onError: (message: string) => void;
  onRemoved: () => void;
}) {
  const [minText, setMinText] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [nameText, setNameText] = useState<string | null>(null);
  const [nameProblem, setNameProblem] = useState<string>();
  const patch = (fields: Partial<HomeRow>) =>
    onChange({ ...config, rows: config.rows.map((r) => (r.id === row.id ? { ...r, ...fields } : r)) });

  const min = row.minItems ?? defaultMinItems(row.type);
  const minProblem = (() => {
    if (minText === null) return undefined;
    const n = Number(minText);
    return minText.trim() === '' || !Number.isInteger(n) || n < 1 || n > 20
      ? 'Use a minimum from 1 to 20 titles'
      : undefined;
  })();
  const stepMin = (delta: number) => {
    const result = setMinItems(config, row.id, Math.max(1, Math.min(20, min + delta)));
    if (result.ok) onChange(result.config);
    setMinText(null);
  };
  const duplicate = duplicateNameNote(config, row.id);
  const hasMin = row.type !== 'continue_watching' && row.type !== 'my_list' && row.type !== 'manual';

  return (
    <section className="adm-card adm-stack" aria-labelledby="row-editor">
      <h2 className="adm-h3" id="row-editor">
        Edit section: {row.name}
      </h2>
      <TextField
        label="Section name"
        value={nameText ?? row.name}
        disabled={!canCurate}
        maxLength={MAX_ROW_NAME + 20}
        aside={`${(nameText ?? row.name).trim().length} of ${MAX_ROW_NAME}`}
        error={nameProblem}
        onChange={(e) => {
          setNameText(e.target.value);
          const result = renameRow(config, row.id, e.target.value);
          setNameProblem(result.ok ? undefined : result.error);
          if (result.ok) onChange(result.config);
        }}
        onBlur={() => {
          setNameText(null);
          setNameProblem(undefined);
        }}
      />
      <TextField label="Type" value={ROW_TYPE_LABELS[row.type]} readOnly />
      {duplicate ? <p className="adm-muted" style={{ margin: 0 }}>{duplicate}</p> : null}

      {row.type !== 'continue_watching' ? (
        <ViewAllField
          mode={row.viewAllMode ?? 'auto'}
          url={row.viewAllUrl ?? ''}
          opens={viewAllOpens({ ...row, viewAllMode: 'auto' }, sources)}
          disabled={!canCurate}
          onChange={(mode, url) => patch({ viewAllMode: mode, viewAllUrl: mode === 'custom' ? url : null })}
        />
      ) : (
        <p className="adm-muted" style={{ margin: 0 }}>
          Continue learning has no View all link.
        </p>
      )}

      {hasMin ? (
        <div className="adm-field">
          <label className="adm-field__label" htmlFor="min-items">
            Minimum titles to show
          </label>
          <div className="adm-row">
            <Button variant="secondary" aria-label="Fewer titles" disabled={!canCurate} onClick={() => stepMin(-1)}>
              -
            </Button>
            <input
              id="min-items"
              className="adm-input adm-input--short"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              disabled={!canCurate}
              aria-invalid={minProblem ? true : undefined}
              value={minText ?? String(min)}
              onChange={(e) => {
                setMinText(e.target.value);
                const n = Number(e.target.value);
                if (e.target.value.trim() !== '' && Number.isInteger(n)) {
                  const result = setMinItems(config, row.id, n);
                  if (result.ok) onChange(result.config);
                }
              }}
              onBlur={() => setMinText(null)}
            />
            <Button variant="secondary" aria-label="More titles" disabled={!canCurate} onClick={() => stepMin(1)}>
              +
            </Button>
          </div>
          {minProblem ? (
            <p className="adm-field__error" role="alert">
              {minProblem}
            </p>
          ) : (
            <p className="adm-field__hint">{hiddenWhile(row, min)}</p>
          )}
        </div>
      ) : null}

      <div className="adm-field">
        <span className="adm-field__label">Show on Kids profiles</span>
        <Switch
          label="Show on Kids profiles"
          checked={row.kidsVisible !== false}
          disabled={!canCurate}
          onLabel="Shown"
          offLabel="Hidden"
          onChange={(value) => onChange(setKidsVisible(config, row.id, value))}
        />
        <p className="adm-field__hint">Only kid safe titles appear in this section for kids.</p>
      </div>

      {row.type === 'manual' ? (
        <ManualTitles config={config} row={row} titles={titles} canCurate={canCurate} onChange={onChange} onError={onError} />
      ) : null}

      <div className="adm-stack">
        <Button variant="danger" disabled={!canCurate || isFixed(row)} onClick={() => setConfirming(true)}>
          Remove section
        </Button>
        {isFixed(row) ? (
          <p className="adm-muted" style={{ margin: 0 }}>
            Built in sections can be hidden but not removed.
          </p>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirming}
        title={`Remove ${row.name}?`}
        consequence={`The ${row.name} section leaves Home. Titles stay in your library. You can add the section again later.`}
        confirmLabel="Remove section"
        danger
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          const result = removeRow(config, row.id);
          setConfirming(false);
          if (result.ok) {
            onChange(result.config);
            onRemoved();
          } else onError(result.error);
        }}
      />
    </section>
  );
}
