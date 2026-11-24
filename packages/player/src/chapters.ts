/** Chapters of one video, in seconds (M43). Order is the order of `start`. */
export interface PlayerChapter {
  start: number;
  title: string;
}

export interface ActiveChapter {
  index: number;
  title: string;
}

/** Sorts, drops bad rows and duplicate starts, and drops chapters at or past the duration when it is known. */
export function normalizeChapters(
  input: readonly PlayerChapter[] | undefined,
  duration: number,
): PlayerChapter[] {
  const knownDuration = Number.isFinite(duration) && duration > 0;
  const seen = new Set<number>();
  const out: PlayerChapter[] = [];
  const sorted = [...(input ?? [])]
    .filter((c) => Number.isFinite(c.start) && c.start >= 0 && c.title.trim() !== '')
    .sort((a, b) => a.start - b.start);
  for (const chapter of sorted) {
    if (seen.has(chapter.start)) continue;
    if (knownDuration && chapter.start >= duration) continue;
    seen.add(chapter.start);
    out.push({ start: chapter.start, title: chapter.title.trim() });
  }
  return out;
}

/** The chapter that contains `time`, or null before the first one. Expects normalized chapters. */
export function chapterAt(chapters: readonly PlayerChapter[], time: number): ActiveChapter | null {
  let found: ActiveChapter | null = null;
  for (let i = 0; i < chapters.length; i += 1) {
    const chapter = chapters[i]!;
    if (chapter.start <= time) found = { index: i, title: chapter.title };
    else break;
  }
  return found;
}

/** Positions of the gaps between chapters as fractions of the duration. The first chapter has no gap. */
export function chapterTicks(chapters: readonly PlayerChapter[], duration: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  return chapters.filter((c) => c.start > 0 && c.start < duration).map((c) => c.start / duration);
}
