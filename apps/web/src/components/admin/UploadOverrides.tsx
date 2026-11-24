'use client';

import { formatBytes } from '@/lib/uploader/format';
import {
  titleFromFileName,
  type FileOverride,
  type UploadDetails,
  type UploadSuitability,
} from '@/lib/uploader/upload-details';
import { Badge } from './Badge';
import { Button } from './Button';
import { SelectField, TextField } from './fields';

export interface OverrideRow {
  id: string;
  name: string;
  size: number;
  /** Registered: the draft exists, so the cells are read only. */
  locked: boolean;
  override: FileOverride;
}

const SAME = 'Same as all files';
const NONE = '__none';
const SUITABILITY: Array<{ value: string; label: string }> = [
  { value: '', label: SAME },
  { value: 'everyone', label: 'Everyone' },
  { value: 'kids', label: 'Kids' },
  { value: 'older', label: 'Older viewers' },
];

/**
 * One row per file (M42-S19): title, category, series and episode, suitability. A cell that differs from
 * the shared form carries a Custom badge. Cells are read only once the draft exists.
 */
export function UploadOverrides({
  rows,
  shared,
  categories,
  series,
  onChange,
  onReset,
}: {
  rows: OverrideRow[];
  shared: UploadDetails;
  categories: Array<{ id: string; name: string }>;
  series: Array<{ id: string; title: string }>;
  onChange: (id: string, patch: FileOverride) => void;
  onReset: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  const custom = (on: boolean) =>
    on ? (
      <Badge tone="info">
        Custom
      </Badge>
    ) : null;

  const cells = (row: OverrideRow) => {
    const o = row.override;
    const name = row.name;
    const effectiveSeries = o.seriesId !== undefined ? o.seriesId : shared.seriesId;
    return {
      title: (
        <TextField
          label={`Title for ${name}`}
          value={o.title ?? ''}
          placeholder={titleFromFileName(name)}
          disabled={row.locked}
          maxLength={120}
          onChange={(e) => onChange(row.id, { title: e.target.value })}
        />
      ),
      category: (
        <SelectField
          label={`Category for ${name}`}
          value={o.categoryIds?.[0] ?? ''}
          disabled={row.locked}
          options={[{ value: '', label: SAME }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          onChange={(e) => onChange(row.id, { categoryIds: e.target.value ? [e.target.value] : undefined })}
        />
      ),
      series: (
        <SelectField
          label={`Series for ${name}`}
          value={o.seriesId === undefined ? '' : o.seriesId === null ? NONE : o.seriesId}
          disabled={row.locked}
          options={[
            { value: '', label: SAME },
            { value: NONE, label: 'No series' },
            ...series.map((s) => ({ value: s.id, label: s.title })),
          ]}
          onChange={(e) =>
            onChange(row.id, {
              seriesId: e.target.value === '' ? undefined : e.target.value === NONE ? null : e.target.value,
            })
          }
        />
      ),
      episode: (
        <TextField
          label={`Episode for ${name}`}
          type="number"
          min={1}
          inputMode="numeric"
          value={o.episodeNumber ? String(o.episodeNumber) : ''}
          placeholder={shared.numberEpisodes ? 'Auto' : ''}
          disabled={row.locked || !effectiveSeries}
          onChange={(e) =>
            onChange(row.id, { episodeNumber: e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : undefined })
          }
        />
      ),
      suitability: (
        <SelectField
          label={`Suitability for ${name}`}
          value={o.suitability ?? ''}
          disabled={row.locked}
          options={SUITABILITY}
          onChange={(e) =>
            onChange(row.id, { suitability: (e.target.value || undefined) as UploadSuitability | undefined })
          }
        />
      ),
      badges: {
        title: custom(Boolean(o.title)),
        category: custom(o.categoryIds !== undefined),
        series: custom(o.seriesId !== undefined || o.episodeNumber !== undefined),
        suitability: custom(o.suitability !== undefined),
      },
      anyCustom: Object.values(o).some((v) => v !== undefined && v !== ''),
    };
  };

  return (
    <section className="adm-card adm-table-card" aria-labelledby="overrides-title">
      <div className="adm-card__head">
        <h2 className="adm-h3" id="overrides-title">
          Details for each file
        </h2>
        <p className="adm-muted" style={{ margin: 0 }}>
          Change one file without touching the others. {SAME} until you edit a cell.
        </p>
      </div>
      <table className="adm-table">
        <caption className="adm-sr">Details for each file in the upload</caption>
        <thead>
          <tr>
            <th scope="col">File</th>
            <th scope="col" className="adm-num">
              Size
            </th>
            <th scope="col">Title</th>
            <th scope="col">Category</th>
            <th scope="col">Series</th>
            <th scope="col">Episode</th>
            <th scope="col">Suitability</th>
            <th scope="col">
              <span className="adm-sr">Reset</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const c = cells(row);
            return (
              <tr key={row.id}>
                <th scope="row">{row.name}</th>
                <td className="adm-num">{formatBytes(row.size)}</td>
                <td>
                  {c.title} {c.badges.title}
                </td>
                <td>
                  {c.category} {c.badges.category}
                </td>
                <td>
                  {c.series} {c.badges.series}
                </td>
                <td>{c.episode}</td>
                <td>
                  {c.suitability} {c.badges.suitability}
                </td>
                <td>
                  {!row.locked && c.anyCustom ? (
                    <Button variant="ghost" aria-label={`Reset ${row.name}`} onClick={() => onReset(row.id)}>
                      Reset
                    </Button>
                  ) : row.locked ? (
                    <span className="adm-muted">Saved</span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="adm-cards" aria-label="Details for each file">
        {rows.map((row) => {
          const c = cells(row);
          return (
            <li key={row.id} className="adm-card adm-stack">
              <strong>{row.name}</strong>
              <span className="adm-muted">{formatBytes(row.size)}</span>
              {c.title}
              {c.category}
              {c.series}
              {c.episode}
              {c.suitability}
              {c.anyCustom && !row.locked ? (
                <Button variant="ghost" aria-label={`Reset ${row.name}`} onClick={() => onReset(row.id)}>
                  Reset
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
