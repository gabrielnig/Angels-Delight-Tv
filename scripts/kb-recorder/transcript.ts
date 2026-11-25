import type { Cue, StepTiming } from './captions';

/** m:ss, or h:mm:ss for long videos. */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

function lengthLabel(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s} s`;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

export interface TranscriptStep {
  n: number;
  caption: string;
  startMs: number;
  /** The name of the control the pointer went to, from the page, so a reader without sight gets the whole procedure. */
  pointer?: string;
}

/**
 * The transcript under each video ("Read this video", plan section 12.1): every caption with its time, and what the
 * pointer does. Plain text with no dashes, so it also passes the copy lint.
 */
export function renderTranscript(o: {
  id: string;
  title: string;
  audience: string;
  totalMs: number;
  steps: TranscriptStep[];
}): string {
  const lines = [`${o.title} (${o.id})`, `For ${o.audience}. ${lengthLabel(o.totalMs)}.`, ''];
  for (const s of o.steps) {
    lines.push(`${clock(s.startMs)}  ${s.caption}`);
    if (s.pointer) lines.push(`      The pointer moves to ${s.pointer}.`);
  }
  return lines.join('\n') + '\n';
}

export interface Chapter {
  startMs: number;
  title: string;
}

type ChapterTiming = StepTiming & { chapter?: string };

/**
 * Chapters: a step that names a chapter starts one, and the first step always starts one. With no named chapters
 * every captioned step is its own chapter.
 */
export function chapterList(steps: ChapterTiming[]): Chapter[] {
  const captioned = steps.filter((s) => s.caption);
  if (captioned.length === 0) return [];
  if (!captioned.some((s) => s.chapter)) {
    return captioned.map((s) => ({
      startMs: s === captioned[0] ? 0 : s.startMs,
      title: s.caption!,
    }));
  }
  const out: Chapter[] = [];
  for (const [i, s] of captioned.entries()) {
    if (s.chapter) out.push({ startMs: i === 0 ? 0 : s.startMs, title: s.chapter });
  }
  if (out[0] && out[0].startMs !== 0) out[0] = { ...out[0], startMs: 0 };
  return out;
}

const ts = (ms: number) => {
  const t = Math.round(ms);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(t / 3_600_000))}:${p(Math.floor((t % 3_600_000) / 60_000))}:${p(Math.floor((t % 60_000) / 1000))}.${p(t % 1000, 3)}`;
};

/** A WebVTT chapters track: each chapter runs to the next, the last to the end of the video. */
export function renderChaptersVtt(chapters: Chapter[], totalMs: number): string {
  const body = chapters
    .map((c, i) => `${ts(c.startMs)} --> ${ts(chapters[i + 1]?.startMs ?? totalMs)}\n${c.title}`)
    .join('\n\n');
  return `WEBVTT\n\n${body}\n`;
}

export interface Skip {
  startMs: number;
  endMs: number;
}

/** Moves a time on the raw recording to the time in the video once skipped waits are cut out. */
export function remapMs(t: number, skips: Skip[]): number {
  let removed = 0;
  for (const s of skips) {
    if (t >= s.endMs) removed += s.endMs - s.startMs;
    else if (t > s.startMs) removed += t - s.startMs;
  }
  return t - removed;
}

/** An ffmpeg `select` expression that drops the skipped seconds, or null when nothing is skipped. */
export function skipSelectExpression(skips: Skip[]): string | null {
  if (skips.length === 0) return null;
  const parts = skips.map(
    (s) => `not(between(t,${(s.startMs / 1000).toFixed(3)},${(s.endMs / 1000).toFixed(3)}))`,
  );
  return `select='${parts.join('*')}'`;
}

/** "Step 3 of 7" for the fixed corner badge, one per captioned step. */
export function buildStepBadges(steps: StepTiming[]): Cue[] {
  const captioned = steps.filter((s) => s.caption);
  return captioned.map((s, i) => ({
    startMs: s.startMs,
    endMs: s.endMs,
    text: `Step ${i + 1} of ${captioned.length}`,
  }));
}

export interface Card {
  startMs: number;
  endMs: number;
  lines: string[];
}

export const CARD_MS = 3000;

/** A 3 second title card before the video and a 3 second end card after it (plan section 5.3). Times are in the final video. */
export function buildCards(o: {
  id: string;
  title: string;
  audience: string;
  lengthLabel: string;
  next?: string;
  totalMs: number;
}): Card[] {
  const cards: Card[] = [
    { startMs: 0, endMs: CARD_MS, lines: [o.title, `For ${o.audience}`, o.lengthLabel] },
  ];
  if (o.next) {
    const start = CARD_MS + o.totalMs;
    cards.push({ startMs: start, endMs: start + CARD_MS, lines: [`Next: ${o.next}`, o.id] });
  }
  return cards;
}
