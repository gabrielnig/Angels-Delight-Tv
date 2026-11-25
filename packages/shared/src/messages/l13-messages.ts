/**
 * Copy for lane L13 (module M51): series with configurable names. Preset words live here so each language can
 * translate them (R23). Custom words typed by the owner are never translated. Keys follow `area.kind.name`.
 */
export const L13_MESSAGES = {
  'series.preset.season_episode.group': { one: 'Season', other: 'Seasons' },
  'series.preset.season_episode.item': { one: 'Episode', other: 'Episodes' },
  'series.preset.season_episode.groupCode': 'S',
  'series.preset.season_episode.itemCode': 'E',
  'series.preset.book_chapter.group': { one: 'Book', other: 'Books' },
  'series.preset.book_chapter.item': { one: 'Chapter', other: 'Chapters' },
  'series.preset.book_chapter.groupCode': 'B',
  'series.preset.book_chapter.itemCode': 'Ch',
  'series.preset.part_lesson.group': { one: 'Part', other: 'Parts' },
  'series.preset.part_lesson.item': { one: 'Lesson', other: 'Lessons' },
  'series.preset.part_lesson.groupCode': 'P',
  'series.preset.part_lesson.itemCode': 'L',
  'series.preset.module_lesson.group': { one: 'Module', other: 'Modules' },
  'series.preset.module_lesson.item': { one: 'Lesson', other: 'Lessons' },
  'series.preset.module_lesson.groupCode': 'M',
  'series.preset.module_lesson.itemCode': 'L',
  'series.preset.custom.name': 'Custom names',
  'series.preset.season_episode.name': 'Season and Episode',
  'series.preset.book_chapter.name': 'Book and Chapter',
  'series.preset.part_lesson.name': 'Part and Lesson',
  'series.preset.module_lesson.name': 'Module and Lesson',
  'series.labels.summary': '{group}, {count} {item}',
  'series.labels.numbered': '{word} {number}',
  'series.labels.count': '{count} {word}',
  'series.labels.itemTitle': '{item}: {title}',
  'series.labels.itemProgress': '{item} progress',
  'series.labels.position': '{group}, {item}',
  'series.labels.positionShort': '{group} {item}',
} as const;
