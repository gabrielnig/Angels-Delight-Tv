'use client';

import { itemInSentence, resolveSeriesLabels, type SeriesLabelSetting } from '@ad/shared/series-labels';
import { useState } from 'react';
import {
  EMPTY_DETAILS,
  summarizeDetails,
  type UploadDetails,
  type UploadSuitability,
} from '@/lib/uploader/upload-details';
import { Button } from './Button';
import { Checkbox, SelectField, TextField } from './fields';

const SUITABILITY: Array<{ value: UploadSuitability; label: string }> = [
  { value: '', label: 'Not set' },
  { value: 'everyone', label: 'Everyone' },
  { value: 'kids', label: 'Kids' },
  { value: 'older', label: 'Older viewers' },
];

/**
 * Details applied to every file in the batch (M42-S18). Open before files are added, a one line summary
 * with Edit afterwards. Changing it affects only files added after the change.
 */
export function UploadDetailsForm({
  details,
  onChange,
  categories,
  series,
  fileCount,
  open,
  onOpen,
  onClose,
}: {
  details: UploadDetails;
  onChange: (next: UploadDetails) => void;
  categories: Array<{ id: string; name: string }>;
  series: Array<{ id: string; title: string; labels?: SeriesLabelSetting }>;
  fileCount: number;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [tagsText, setTagsText] = useState(details.tags.join(', '));
  const words = resolveSeriesLabels(series.find((s) => s.id === details.seriesId)?.labels, null);
  if (!open) {
    return (
      <div className="adm-card adm-row" style={{ justifyContent: 'space-between' }}>
        <p style={{ margin: 0 }}>{summarizeDetails(details, fileCount, categories, series)}</p>
        <Button variant="ghost" onClick={onOpen}>
          Edit details
        </Button>
      </div>
    );
  }
  const toggle = (id: string) =>
    onChange({
      ...details,
      categoryIds: details.categoryIds.includes(id)
        ? details.categoryIds.filter((c) => c !== id)
        : [...details.categoryIds, id],
    });
  return (
    <fieldset className="adm-card adm-fieldset adm-stack">
      <legend className="adm-h3">Details for every file</legend>
      <p className="adm-muted" style={{ margin: 0 }}>
        These apply to each file you add next. Leave a field blank to set it later.
      </p>
      <div role="group" aria-label="Categories" className="adm-row">
        {categories.map((c) => (
          <Checkbox
            key={c.id}
            label={c.name}
            checked={details.categoryIds.includes(c.id)}
            onChange={() => toggle(c.id)}
          />
        ))}
      </div>
      <SelectField
        label="Series"
        value={details.seriesId ?? ''}
        options={[{ value: '', label: 'No series' }, ...series.map((s) => ({ value: s.id, label: s.title }))]}
        onChange={(e) => onChange({ ...details, seriesId: e.target.value || null })}
      />
      {details.seriesId ? (
        <div className="adm-row" style={{ alignItems: 'flex-end' }}>
          <Checkbox
            label={`Number ${itemInSentence(words, 2)} in file order`}
            checked={details.numberEpisodes}
            onChange={(e) => onChange({ ...details, numberEpisodes: e.target.checked })}
          />
          {details.numberEpisodes ? (
            <TextField
              label={`Start at ${itemInSentence(words, 1)}`}
              type="number"
              min={1}
              inputMode="numeric"
              value={String(details.startEpisode)}
              onChange={(e) =>
                onChange({ ...details, startEpisode: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
              }
            />
          ) : null}
        </div>
      ) : null}
      <SelectField
        label="Suitability"
        value={details.suitability}
        options={SUITABILITY}
        hint="Left blank, the publish checklist asks for it."
        onChange={(e) => onChange({ ...details, suitability: e.target.value as UploadSuitability })}
      />
      <TextField
        label="Tags"
        hint="Optional. Separate with commas. Up to 10."
        value={tagsText}
        onChange={(e) => {
          setTagsText(e.target.value);
          onChange({
            ...details,
            tags: e.target.value
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 10),
          });
        }}
      />
      <div className="adm-row">
        <Button
          variant="ghost"
          onClick={() => {
            setTagsText('');
            onChange(EMPTY_DETAILS);
          }}
        >
          Clear
        </Button>
        {fileCount > 0 ? <Button onClick={onClose}>Done</Button> : null}
      </div>
    </fieldset>
  );
}
