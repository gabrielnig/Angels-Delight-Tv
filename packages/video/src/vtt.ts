export interface Cue {
  startMs: number;
  endMs: number;
  text: string;
}

export class VttError extends Error {
  constructor(
    readonly line: number,
    readonly reason: string,
  ) {
    super(`Caption file problem on line ${line}: ${reason}`);
    this.name = 'VttError';
  }
}

const ALLOWED_TAG = /^<\/?(b|i|u)>$/;

/** Cue text is plain text plus b, i and u (SECURITY section 8). Everything else is removed or escaped. */
export function sanitizeCueText(input: string): string {
  const withoutTags = input.replace(/<\/?([a-zA-Z][^>]*)>/g, (tag, inner: string) => {
    const name = (inner.match(/^[a-zA-Z]+/)?.[0] ?? '').toLowerCase();
    if (!['b', 'i', 'u'].includes(name)) return '';
    return tag.startsWith('</') ? `</${name}>` : `<${name}>`;
  });
  return withoutTags
    .split(/(<\/?[biu]>)/)
    .map((part) =>
      ALLOWED_TAG.test(part)
        ? part
        : part
            .replace(/&(?!(amp|lt|gt|quot|nbsp|lrm|rlm);)/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;'),
    )
    .join('');
}

function formatTime(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const millis = total % 1000;
  const seconds = Math.floor(total / 1000) % 60;
  const minutes = Math.floor(total / 60_000) % 60;
  const hours = Math.floor(total / 3_600_000);
  const base = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  return hours > 0 ? `${String(hours).padStart(2, '0')}:${base}` : base;
}

export function serializeVtt(cues: Cue[]): string {
  const blocks = cues.map(
    (cue) => `${formatTime(cue.startMs)} --> ${formatTime(cue.endMs)}\n${cue.text}`,
  );
  return `WEBVTT\n\n${blocks.join('\n\n')}${blocks.length ? '\n' : ''}`;
}

const TIMESTAMP = /^(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{3})$/;

function parseTimestamp(text: string): number | null {
  const match = TIMESTAMP.exec(text.trim());
  if (!match) return null;
  const [, h, m, s, ms] = match;
  if (Number(m) > 59 || Number(s) > 59) return null;
  return Number(h ?? 0) * 3_600_000 + Number(m) * 60_000 + Number(s) * 1000 + Number(ms);
}

function parseTiming(line: string): { startMs: number; endMs: number } | null {
  const [left, right] = line.split('-->');
  if (right === undefined) return null;
  const startMs = parseTimestamp(left ?? '');
  const endMs = parseTimestamp(right.trim().split(/\s+/)[0] ?? '');
  return startMs === null || endMs === null ? null : { startMs, endMs };
}

interface Block {
  startLine: number;
  lines: string[];
}

function blocksOf(text: string): Block[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  const blocks: Block[] = [];
  let current: Block | null = null;
  lines.forEach((line, index) => {
    if (line.trim() === '') {
      current = null;
      return;
    }
    if (!current) {
      current = { startLine: index + 1, lines: [] };
      blocks.push(current);
    }
    current.lines.push(line);
  });
  return blocks;
}

function cuesFromBlocks(blocks: Block[]): Cue[] {
  const cues: Cue[] = [];
  for (const block of blocks) {
    const timingIndex = block.lines.findIndex((line) => line.includes('-->'));
    if (timingIndex === -1 || timingIndex > 1) continue;
    const line = block.startLine + timingIndex;
    const timing = parseTiming(block.lines[timingIndex] ?? '');
    if (!timing)
      throw new VttError(line, 'the timing line is not in the form 00:00.000 --> 00:00.000');
    const text = sanitizeCueText(block.lines.slice(timingIndex + 1).join('\n'));
    cues.push({ ...timing, text });
  }
  return cues;
}

/** Strict WebVTT parse. NOTE and STYLE blocks and cue settings are dropped, text is sanitised. */
export function parseVtt(text: string): Cue[] {
  const blocks = blocksOf(text);
  const header = blocks[0]?.lines[0] ?? '';
  if (!/^WEBVTT(\s|$)/.test(header)) throw new VttError(1, 'the file does not start with WEBVTT');
  return cuesFromBlocks(
    blocks.slice(1).filter((block) => !/^(NOTE|STYLE|REGION)(\s|$)/.test(block.lines[0] ?? '')),
  );
}

/** SubRip to cues. A bad timing line reports its line number. */
export function parseSrt(text: string): Cue[] {
  const blocks = blocksOf(text);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const timingIndex = block.lines.findIndex((line) => line.includes('-->'));
    if (timingIndex === -1) {
      throw new VttError(block.startLine, 'no timing line found in this block');
    }
    const line = block.startLine + timingIndex;
    const timing = parseTiming(block.lines[timingIndex] ?? '');
    if (!timing)
      throw new VttError(line, 'the timing line is not in the form 00:00:00,000 --> 00:00:00,000');
    cues.push({ ...timing, text: sanitizeCueText(block.lines.slice(timingIndex + 1).join('\n')) });
  }
  return cues;
}

export interface TimedWord {
  word: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

export const MAX_LINE_CHARS = 42;
export const MAX_CUE_MS = 7000;
export const MIN_CUE_MS = 1000;
const SILENCE_BREAK_MS = 1500;
const SOFT_CUE_MS = 6000;

function wrapLines(words: string[]): string[] | null {
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= MAX_LINE_CHARS) {
      line = next;
    } else if (line) {
      lines.push(line);
      line = word;
    } else {
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length <= 2 && lines.every((l) => l.length <= MAX_LINE_CHARS) ? lines : null;
}

/** Groups word timings into cues of at most 2 lines of 42 characters and 1 to 7 seconds (M15-S01). */
export function cuesFromWords(words: TimedWord[]): Cue[] {
  const cues: Cue[] = [];
  let group: TimedWord[] = [];

  const flush = () => {
    if (group.length === 0) return;
    const lines = wrapLines(group.map((w) => w.word)) ?? [group.map((w) => w.word).join(' ')];
    cues.push({
      startMs: group[0]!.startMs,
      endMs: group[group.length - 1]!.endMs,
      text: sanitizeCueText(lines.join('\n')),
    });
    group = [];
  };

  for (const word of words) {
    const last = group[group.length - 1];
    if (last) {
      const silence = word.startMs - last.endMs;
      const tooLong = word.endMs - group[0]!.startMs > MAX_CUE_MS - 200;
      const doesNotFit = wrapLines([...group.map((w) => w.word), word.word]) === null;
      const sentenceDone =
        /[.!?]$/.test(last.word) && last.endMs - group[0]!.startMs >= SOFT_CUE_MS / 3;
      if (silence > SILENCE_BREAK_MS || tooLong || doesNotFit || sentenceDone) flush();
    }
    group.push(word);
  }
  flush();

  cues.forEach((cue, index) => {
    const next = cues[index + 1];
    const limit = next ? next.startMs : Infinity;
    if (cue.endMs - cue.startMs < MIN_CUE_MS) cue.endMs = Math.min(cue.startMs + MIN_CUE_MS, limit);
  });
  return cues;
}

export type CueWarningKind =
  'overlap' | 'empty' | 'too_long' | 'line_too_long' | 'end_before_start';

export interface CueWarning {
  index: number;
  kind: CueWarningKind;
}

/** The warnings the approve dialog lists (M15-S07 AC2). */
export function validateCues(cues: Cue[]): CueWarning[] {
  const warnings: CueWarning[] = [];
  cues.forEach((cue, index) => {
    if (cue.endMs <= cue.startMs) warnings.push({ index, kind: 'end_before_start' });
    if (cue.text.trim() === '') warnings.push({ index, kind: 'empty' });
    if (cue.endMs - cue.startMs > MAX_CUE_MS) warnings.push({ index, kind: 'too_long' });
    if (cue.text.split('\n').some((line) => line.length > MAX_LINE_CHARS)) {
      warnings.push({ index, kind: 'line_too_long' });
    }
    const previous = cues[index - 1];
    if (previous && cue.startMs < previous.endMs) warnings.push({ index, kind: 'overlap' });
  });
  return warnings;
}

export function findReplace(
  cues: Cue[],
  find: string,
  replacement: string,
  options: { matchCase?: boolean } = {},
): { cues: Cue[]; count: number } {
  if (find === '') return { cues, count: 0 };
  const pattern = new RegExp(
    find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    options.matchCase ? 'g' : 'gi',
  );
  let count = 0;
  const next = cues.map((cue) => ({
    ...cue,
    text: cue.text.replace(pattern, () => {
      count++;
      return replacement;
    }),
  }));
  return { cues: next, count };
}
