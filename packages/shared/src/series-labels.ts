import { msg as defaultMsg, type Translate } from './messages';

/**
 * Series labels (M50). The owner can word the groups and items of a series: Season and Episode by default, or
 * Book and Chapter, Part and Lesson, Module and Lesson, or any four words. This file is the only place that
 * builds those phrases; every screen, notice, mail and SEO text calls it. Preset words come from the message
 * catalogs so each language can translate them. Custom words are shown as typed in every language (D-351).
 */

export const SERIES_PRESETS = [
  'season_episode',
  'book_chapter',
  'part_lesson',
  'module_lesson',
  'custom',
] as const;
export type SeriesPreset = (typeof SERIES_PRESETS)[number];

export interface WordPair {
  one: string;
  other: string;
}

export interface SeriesLabelSetting {
  preset: SeriesPreset;
  /** Required when preset is custom. */
  custom?: { group: WordPair; item: WordPair };
  /** Item code prefix such as E, Ch or L. Falls back to the preset's own code. */
  code?: string;
}

export const DEFAULT_SERIES_LABELS: SeriesLabelSetting = { preset: 'season_episode' };

/** Resolved words for one series, ready for the helpers below. */
export interface SeriesWords {
  group: WordPair;
  item: WordPair;
  groupCode: string;
  itemCode: string;
  /** True when the words were typed by the owner, so they are kept as typed inside a sentence. */
  typed: boolean;
}

export const WORD_MAX = 24;
export const CODE_MAX = 4;

const FORBIDDEN = new RegExp(
  `[${String.fromCharCode(0x2013, 0x2014)}<>&]|\\p{Extended_Pictographic}|\\p{Cc}`,
  'u',
);

function presetWords(preset: Exclude<SeriesPreset, 'custom'>, msg: Translate): SeriesWords {
  switch (preset) {
    case 'book_chapter':
      return {
        group: {
          one: msg('series.preset.book_chapter.group', { count: 1 }),
          other: msg('series.preset.book_chapter.group', { count: 2 }),
        },
        item: {
          one: msg('series.preset.book_chapter.item', { count: 1 }),
          other: msg('series.preset.book_chapter.item', { count: 2 }),
        },
        groupCode: msg('series.preset.book_chapter.groupCode'),
        itemCode: msg('series.preset.book_chapter.itemCode'),
        typed: false,
      };
    case 'part_lesson':
      return {
        group: {
          one: msg('series.preset.part_lesson.group', { count: 1 }),
          other: msg('series.preset.part_lesson.group', { count: 2 }),
        },
        item: {
          one: msg('series.preset.part_lesson.item', { count: 1 }),
          other: msg('series.preset.part_lesson.item', { count: 2 }),
        },
        groupCode: msg('series.preset.part_lesson.groupCode'),
        itemCode: msg('series.preset.part_lesson.itemCode'),
        typed: false,
      };
    case 'module_lesson':
      return {
        group: {
          one: msg('series.preset.module_lesson.group', { count: 1 }),
          other: msg('series.preset.module_lesson.group', { count: 2 }),
        },
        item: {
          one: msg('series.preset.module_lesson.item', { count: 1 }),
          other: msg('series.preset.module_lesson.item', { count: 2 }),
        },
        groupCode: msg('series.preset.module_lesson.groupCode'),
        itemCode: msg('series.preset.module_lesson.itemCode'),
        typed: false,
      };
    default:
      return {
        group: {
          one: msg('series.preset.season_episode.group', { count: 1 }),
          other: msg('series.preset.season_episode.group', { count: 2 }),
        },
        item: {
          one: msg('series.preset.season_episode.item', { count: 1 }),
          other: msg('series.preset.season_episode.item', { count: 2 }),
        },
        groupCode: msg('series.preset.season_episode.groupCode'),
        itemCode: msg('series.preset.season_episode.itemCode'),
        typed: false,
      };
  }
}

/** The series override wins over the site default, which wins over the compiled default. */
export function resolveSeriesLabels(
  site: SeriesLabelSetting | null | undefined,
  override: SeriesLabelSetting | null | undefined,
  msg: Translate = defaultMsg,
): SeriesWords {
  const chosen = override ?? site ?? DEFAULT_SERIES_LABELS;
  if (chosen.preset === 'custom' && chosen.custom) {
    const group = chosen.custom.group;
    return {
      group,
      item: chosen.custom.item,
      groupCode: [...group.one.trim()][0]?.toLocaleUpperCase() ?? '',
      itemCode:
        chosen.code?.trim() || [...chosen.custom.item.one.trim()][0]?.toLocaleUpperCase() || '',
      typed: true,
    };
  }
  const words = presetWords(chosen.preset === 'custom' ? 'season_episode' : chosen.preset, msg);
  const code = chosen.code?.trim();
  return code ? { ...words, itemCode: code } : words;
}

const pick = (pair: WordPair, count: number) => (count === 1 ? pair.one : pair.other);

/** Word for a group, such as Season or Seasons. */
export function groupWord(words: SeriesWords, count: number): string {
  return pick(words.group, count);
}

/** Word for an item, such as Episode or Episodes. */
export function itemWord(words: SeriesWords, count: number): string {
  return pick(words.item, count);
}

function inSentence(words: SeriesWords, word: string): string {
  return words.typed ? word : word.toLocaleLowerCase();
}

/** "Season 2", or the group's own title when it has one. */
export function groupName(
  words: SeriesWords,
  number: number,
  title?: string | null,
  msg: Translate = defaultMsg,
): string {
  const own = title?.trim();
  if (own) return own;
  return msg('series.labels.numbered', { word: words.group.one, number });
}

/** "Episode 4". */
export function itemName(words: SeriesWords, number: number, msg: Translate = defaultMsg): string {
  return msg('series.labels.numbered', { word: words.item.one, number });
}

/** "E4". */
export function itemCode(words: SeriesWords, number: number): string {
  return `${words.itemCode}${number}`;
}

/** "S1 E4". */
export function positionCode(
  words: SeriesWords,
  group: number,
  item: number,
  msg: Translate = defaultMsg,
): string {
  return msg('series.labels.positionShort', {
    group: `${words.groupCode}${group}`,
    item: itemCode(words, item),
  });
}

/** "Season 1, Episode 4". */
export function positionLong(
  words: SeriesWords,
  group: number,
  item: number,
  msg: Translate = defaultMsg,
): string {
  return msg('series.labels.position', {
    group: groupName(words, group, null, msg),
    item: itemName(words, item, msg),
  });
}

/** "Season 1, 3 episodes". */
export function groupSummary(
  words: SeriesWords,
  group: number,
  count: number,
  msg: Translate = defaultMsg,
  title?: string | null,
): string {
  return msg('series.labels.summary', {
    group: groupName(words, group, title, msg),
    count,
    item: inSentence(words, itemWord(words, count)),
  });
}

/** Item word for the middle of a sentence: "episode" for a preset, as typed for custom words. */
export function itemInSentence(words: SeriesWords, count: number): string {
  return inSentence(words, itemWord(words, count));
}

/** Group word for the middle of a sentence: "season" for a preset, as typed for custom words. */
export function groupInSentence(words: SeriesWords, count: number): string {
  return inSentence(words, groupWord(words, count));
}

/** "8 episodes", "1 chapter". */
export function itemCount(words: SeriesWords, count: number, msg: Translate = defaultMsg): string {
  return msg('series.labels.count', { count, word: inSentence(words, itemWord(words, count)) });
}

/** "3 seasons", "1 book". */
export function groupCount(words: SeriesWords, count: number, msg: Translate = defaultMsg): string {
  return msg('series.labels.count', { count, word: inSentence(words, groupWord(words, count)) });
}

export type SeriesLabelsResult =
  { ok: true; value: SeriesLabelSetting | null } | { ok: false; errors: Record<string, string> };

function checkWord(value: unknown, field: string, errors: Record<string, string>): string {
  const word = typeof value === 'string' ? value.trim() : '';
  if (word === '') errors[field] = 'Enter this word';
  else if (word.length > WORD_MAX) errors[field] = `Use ${WORD_MAX} characters or fewer`;
  else if (FORBIDDEN.test(word)) errors[field] = 'Remove dashes, emoji and markup from this word';
  return word;
}

/** Validates a stored or submitted value. Null means no override. Trims words and the code. */
export function validateSeriesLabels(input: unknown): SeriesLabelsResult {
  if (input === null || input === undefined) return { ok: true, value: null };
  const errors: Record<string, string> = {};
  const raw = input as Record<string, unknown>;
  const preset = raw['preset'];
  if (typeof input !== 'object' || !SERIES_PRESETS.includes(preset as SeriesPreset)) {
    return { ok: false, errors: { preset: 'Choose one of the listed name sets' } };
  }
  const value: SeriesLabelSetting = { preset: preset as SeriesPreset };
  if (preset === 'custom') {
    const custom = (raw['custom'] ?? {}) as {
      group?: Record<string, unknown>;
      item?: Record<string, unknown>;
    };
    value.custom = {
      group: {
        one: checkWord(custom.group?.['one'], 'custom.group.one', errors),
        other: checkWord(custom.group?.['other'], 'custom.group.other', errors),
      },
      item: {
        one: checkWord(custom.item?.['one'], 'custom.item.one', errors),
        other: checkWord(custom.item?.['other'], 'custom.item.other', errors),
      },
    };
  }
  if (raw['code'] !== undefined && raw['code'] !== null && String(raw['code']).trim() !== '') {
    const code = String(raw['code']).trim();
    if (code.length > CODE_MAX) errors['code'] = `Use ${CODE_MAX} characters or fewer`;
    else if (!/^[\p{L}\p{N}]+$/u.test(code))
      errors['code'] = 'Use letters and numbers only, no spaces';
    else value.code = code;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}

/** What a series shows: its own valid override, else the valid site value, else the compiled default. */
export function effectiveSeriesLabels(site: unknown, override: unknown): SeriesLabelSetting {
  const own = validateSeriesLabels(override);
  if (own.ok && own.value) return own.value;
  const shared = validateSeriesLabels(site);
  if (shared.ok && shared.value) return shared.value;
  return DEFAULT_SERIES_LABELS;
}
