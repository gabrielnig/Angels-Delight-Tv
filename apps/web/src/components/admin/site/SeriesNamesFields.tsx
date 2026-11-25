'use client';

import { msg } from '@ad/shared/messages';
import {
  SERIES_PRESETS,
  groupName,
  itemCode,
  itemName,
  positionCode,
  positionLong,
  resolveSeriesLabels,
  validateSeriesLabels,
  type SeriesLabelSetting,
  type SeriesPreset,
} from '@ad/shared/series-labels';
import { SelectField, TextField } from '../fields';

const PRESET_NAMES: Record<SeriesPreset, string> = {
  season_episode: msg('series.preset.season_episode.name'),
  book_chapter: msg('series.preset.book_chapter.name'),
  part_lesson: msg('series.preset.part_lesson.name'),
  module_lesson: msg('series.preset.module_lesson.name'),
  custom: msg('series.preset.custom.name'),
};

const EMPTY_CUSTOM = { group: { one: '', other: '' }, item: { one: '', other: '' } };

/**
 * The name set picker used by the site settings tab and the per series override (M51-S01, S02): a preset or
 * four custom words, an optional item code, and a live preview of what viewers will read.
 */
export function SeriesNamesFields({
  value,
  onChange,
  errors = {},
}: {
  value: SeriesLabelSetting;
  onChange: (value: SeriesLabelSetting) => void;
  /** Keys as returned by `validateSeriesLabels`: preset, code, custom.group.one and so on. */
  errors?: Record<string, string>;
}) {
  const custom = value.custom ?? EMPTY_CUSTOM;
  const setPreset = (preset: SeriesPreset) =>
    onChange({
      preset,
      ...(preset === 'custom' ? { custom: value.custom ?? EMPTY_CUSTOM } : {}),
      ...(value.code ? { code: value.code } : {}),
    });
  const setWord = (part: 'group' | 'item', form: 'one' | 'other', text: string) =>
    onChange({ ...value, custom: { ...custom, [part]: { ...custom[part], [form]: text } } });

  const checked = validateSeriesLabels(value);
  const preview = checked.ok && checked.value ? resolveSeriesLabels(checked.value, null) : null;

  const word = (part: 'group' | 'item', form: 'one' | 'other', label: string) => (
    <TextField
      label={label}
      value={custom[part][form]}
      error={errors[`custom.${part}.${form}`]}
      maxLength={40}
      onChange={(event) => setWord(part, form, event.target.value)}
    />
  );

  return (
    <div className="adm-stack">
      <SelectField
        label="Name set"
        hint="The words used for the groups and items of a series"
        value={value.preset}
        error={errors['preset']}
        options={SERIES_PRESETS.map((preset) => ({ value: preset, label: PRESET_NAMES[preset] }))}
        onChange={(event) => setPreset(event.target.value as SeriesPreset)}
      />
      {value.preset === 'custom' ? (
        <div className="adm-stack">
          {word('group', 'one', 'Group, singular')}
          {word('group', 'other', 'Group, plural')}
          {word('item', 'one', 'Item, singular')}
          {word('item', 'other', 'Item, plural')}
        </div>
      ) : null}
      <TextField
        label="Item code"
        hint="One to four letters or numbers shown on small cards, such as E, Ch or L. Leave empty for the usual one"
        value={value.code ?? ''}
        error={errors['code']}
        maxLength={8}
        onChange={(event) => {
          const { code: _code, ...rest } = value;
          void _code;
          onChange(event.target.value === '' ? rest : { ...rest, code: event.target.value });
        }}
      />
      {preview ? (
        <ul className="adm-list" aria-label="Preview">
          <li>{positionLong(preview, 1, 4)}</li>
          <li>{positionCode(preview, 1, 4)}</li>
          <li>{msg('engage.continue.next', { code: itemCode(preview, 4) })}</li>
          <li>{`${groupName(preview, 2)} / ${itemName(preview, 1)}`}</li>
        </ul>
      ) : null}
    </div>
  );
}
