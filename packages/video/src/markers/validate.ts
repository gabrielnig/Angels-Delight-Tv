import { ValidationFailed } from '@ad/shared';

export const MARKER_KINDS = ['intro', 'recap', 'credits'] as const;
export type MarkerKind = (typeof MARKER_KINDS)[number];

export interface MarkerInput {
  kind: MarkerKind;
  startMs: number;
  /** Null on credits means "to the end of the video", so a replaced video never leaves a stale end. */
  endMs: number | null;
}

export interface ChapterInput {
  startMs: number;
  title: string;
}

export const MIN_WINDOW_MS = 3_000;
export const MIN_CHAPTER_GAP_MS = 5_000;
export const MAX_CHAPTERS = 50;
export const MAX_CHAPTER_TITLE = 60;

const LABEL: Record<MarkerKind, string> = { intro: 'Intro', recap: 'Recap', credits: 'Credits' };

function addError(errors: Record<string, string[]>, key: string, message: string): void {
  (errors[key] ??= []).push(message);
}

function isMs(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Checks the skip windows for one video. Returns them in start order, rounded to whole milliseconds.
 * `durationMs` is null while the video has no probed length, in which case only the shape is checked.
 */
export function validateMarkers(input: MarkerInput[], durationMs: number | null): MarkerInput[] {
  const errors: Record<string, string[]> = {};
  const seen = new Set<string>();
  const clean: MarkerInput[] = [];

  for (const marker of input) {
    if (!MARKER_KINDS.includes(marker?.kind)) {
      addError(errors, 'markers', 'Unknown marker type.');
      continue;
    }
    const kind = marker.kind;
    const label = LABEL[kind];
    if (seen.has(kind)) {
      addError(errors, kind, `Only one ${label.toLowerCase()} marker is allowed.`);
      continue;
    }
    seen.add(kind);
    if (!isMs(marker.startMs)) {
      addError(errors, kind, `${label} needs a start time.`);
      continue;
    }
    const startMs = Math.round(marker.startMs);
    let endMs: number | null = null;
    if (marker.endMs === null || marker.endMs === undefined) {
      if (kind !== 'credits') {
        addError(errors, kind, `${label} needs an end time.`);
        continue;
      }
    } else if (!isMs(marker.endMs)) {
      addError(errors, kind, `${label} has an end time that is not valid.`);
      continue;
    } else {
      endMs = Math.round(marker.endMs);
    }
    if (endMs !== null && endMs <= startMs) {
      addError(errors, kind, `${label} must end after it starts.`);
      continue;
    }
    if (kind !== 'credits' && endMs !== null && endMs - startMs < MIN_WINDOW_MS) {
      addError(errors, kind, `${label} must last at least 3 seconds.`);
      continue;
    }
    if (durationMs !== null && (startMs >= durationMs || (endMs !== null && endMs > durationMs))) {
      addError(errors, kind, `${label} runs past the end of the video.`);
      continue;
    }
    clean.push({ kind, startMs, endMs });
  }

  const sorted = [...clean].sort((a, b) => a.startMs - b.startMs);
  const endOf = (m: MarkerInput): number => m.endMs ?? durationMs ?? Number.POSITIVE_INFINITY;
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1]!;
    const current = sorted[i]!;
    if (current.startMs < endOf(previous)) {
      addError(errors, current.kind, `${LABEL[current.kind]} would overlap ${LABEL[previous.kind].toLowerCase()}.`);
    }
  }

  if (Object.keys(errors).length > 0) throw new ValidationFailed(errors);
  return sorted;
}

/** Checks the chapter list. Returns it sorted by start with trimmed titles. */
export function validateChapters(input: ChapterInput[], durationMs: number | null): ChapterInput[] {
  const errors: Record<string, string[]> = {};
  if (input.length > MAX_CHAPTERS) {
    addError(errors, 'chapters', `A video can have up to ${MAX_CHAPTERS} chapters.`);
    throw new ValidationFailed(errors);
  }
  const clean: ChapterInput[] = [];
  input.forEach((chapter, index) => {
    const row = index + 1;
    const title = typeof chapter?.title === 'string' ? chapter.title.trim() : '';
    if (!isMs(chapter?.startMs)) {
      addError(errors, 'chapters', `Chapter ${row} needs a start time.`);
      return;
    }
    if (title.length === 0) {
      addError(errors, 'chapters', `Chapter ${row} needs a title.`);
      return;
    }
    if (title.length > MAX_CHAPTER_TITLE) {
      addError(errors, 'chapters', `Chapter ${row} title can be up to ${MAX_CHAPTER_TITLE} characters.`);
      return;
    }
    clean.push({ startMs: Math.round(chapter.startMs), title });
  });
  clean.sort((a, b) => a.startMs - b.startMs);

  if (clean.length > 0 && clean[0]!.startMs !== 0) {
    addError(errors, 'chapters', 'The first chapter must start at 0:00.');
  }
  for (let i = 1; i < clean.length; i += 1) {
    const gap = clean[i]!.startMs - clean[i - 1]!.startMs;
    if (gap === 0) addError(errors, 'chapters', 'Two chapters cannot start at the same time.');
    else if (gap < MIN_CHAPTER_GAP_MS) {
      addError(errors, 'chapters', 'Chapters must be at least 5 seconds apart.');
    }
  }
  if (durationMs !== null && clean.some((c) => c.startMs >= durationMs)) {
    addError(errors, 'chapters', 'A chapter starts past the end of the video.');
  }
  if (Object.keys(errors).length > 0) throw new ValidationFailed(errors);
  return clean;
}

/** Parses "m:ss" or "h:mm:ss" into milliseconds. Null when the text is not a valid time. */
export function parseClock(text: string): number | null {
  const parts = text.trim().split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => /^\d{1,2}$/.test(p) || (p === parts[0] && /^\d{1,3}$/.test(p)))) return null;
  const numbers = parts.map(Number);
  const seconds = numbers[numbers.length - 1]!;
  const minutes = numbers[numbers.length - 2]!;
  const hours = numbers.length === 3 ? numbers[0]! : 0;
  if (seconds > 59) return null;
  if (numbers.length === 3 && minutes > 59) return null;
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

export interface ChapterParseError {
  line: number;
  message: string;
}

/** Parses pasted "0:00 Title" lines. Blank lines are skipped, bad lines are reported with their number. */
export function parseChapterText(text: string): {
  chapters: ChapterInput[];
  errors: ChapterParseError[];
} {
  const chapters: ChapterInput[] = [];
  const errors: ChapterParseError[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === '') return;
    const match = /^(\d{1,3}(?::\d{1,3}){1,2})\s*[-:|]?\s*(.*)$/.exec(line);
    if (!match) {
      errors.push({ line: index + 1, message: 'Start the line with a time like 2:14.' });
      return;
    }
    const startMs = parseClock(match[1]!);
    if (startMs === null) {
      errors.push({ line: index + 1, message: `${match[1]} is not a valid time.` });
      return;
    }
    const title = (match[2] ?? '').trim();
    if (title === '') {
      errors.push({ line: index + 1, message: 'Add a title after the time.' });
      return;
    }
    chapters.push({ startMs, title });
  });
  return { chapters, errors };
}
