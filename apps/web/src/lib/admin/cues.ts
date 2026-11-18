/** Caption cue maths for the review screen. Pure, so it is tested without a browser. */
export interface Cue {
  id: string;
  /** Milliseconds. */
  start: number;
  end: number;
  text: string;
  /** An aligned script left this cue uncertain. Editing the cue clears it. */
  lowConfidence?: boolean;
}

export type CueWarning = 'overlap' | 'too_long' | 'empty' | 'bad_timing';

export const MAX_CUE_CHARS = 84;
const SPLIT_GAP_MS = 100;

export function parseTimestamp(input: string): number | null {
  const value = input.trim().replace(',', '.');
  const match = /^(?:(\d+):)?(?:(\d{1,2}):)?(\d{1,2}(?:\.\d{1,3})?)$/.exec(value);
  if (!match) return null;
  let hours = 0;
  let minutes = 0;
  if (match[1] !== undefined && match[2] !== undefined) {
    hours = Number(match[1]);
    minutes = Number(match[2]);
  } else if (match[1] !== undefined) {
    minutes = Number(match[1]);
  }
  const seconds = Number(match[3]);
  const hasMinutes = match[1] !== undefined;
  if (minutes > 59 || (hasMinutes && seconds >= 60)) return null;
  return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000);
}

export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const millis = String(total % 1000).padStart(3, '0');
  const seconds = Math.floor(total / 1000) % 60;
  const minutes = Math.floor(total / 60_000) % 60;
  const hours = Math.floor(total / 3_600_000);
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}.${millis}` : `${mm}:${ss}.${millis}`;
}

/** Returns a map from cue id to its warnings. Clean cues are absent. */
export function validateCues(cues: Cue[]): Map<string, CueWarning[]> {
  const out = new Map<string, CueWarning[]>();
  const add = (id: string, warning: CueWarning) => out.set(id, [...(out.get(id) ?? []), warning]);
  cues.forEach((cue, index) => {
    if (cue.end <= cue.start) add(cue.id, 'bad_timing');
    if (!cue.text.trim()) add(cue.id, 'empty');
    else if (cue.text.length > MAX_CUE_CHARS) add(cue.id, 'too_long');
    const previous = cues[index - 1];
    if (previous && cue.start < previous.end) add(cue.id, 'overlap');
  });
  return out;
}

export const WARNING_LABELS: Record<CueWarning, string> = {
  overlap: 'Overlap',
  too_long: 'Too long',
  empty: 'Empty',
  bad_timing: 'Check timing',
};

/** Index of the cue showing at this time, or -1 in a gap. Cues are in time order. */
export function findActiveCue(cues: Cue[], ms: number): number {
  let low = 0;
  let high = cues.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = cues[mid]!;
    if (ms < cue.start) high = mid - 1;
    else if (ms >= cue.end) low = mid + 1;
    else return mid;
  }
  return -1;
}

export function splitCue(cue: Cue, at: number, newId: (n: number) => string): Cue[] {
  const text = cue.text;
  if (at <= 0 || at >= text.length) return [cue];
  const first = text.slice(0, at).trim();
  const second = text.slice(at).trim();
  if (!first || !second) return [cue];
  const share = first.length / (first.length + second.length);
  const cut = Math.round(cue.start + (cue.end - cue.start) * share);
  const firstEnd = Math.max(cue.start + 1, cut - SPLIT_GAP_MS / 2);
  return [
    { ...cue, text: first, end: firstEnd, lowConfidence: false },
    {
      id: newId(1),
      start: Math.min(cue.end - 1, firstEnd + SPLIT_GAP_MS),
      end: cue.end,
      text: second,
    },
  ];
}

export function mergeCues(a: Cue, b: Cue): Cue {
  return {
    id: a.id,
    start: a.start,
    end: Math.max(a.end, b.end),
    text: `${a.text.trim()} ${b.text.trim()}`.trim(),
  };
}

export function findReplace(
  cues: Cue[],
  find: string,
  replace: string,
  options: { matchCase?: boolean },
) {
  if (!find) return { cues, count: 0 };
  let count = 0;
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped, options.matchCase ? 'g' : 'gi');
  const next = cues.map((cue) => {
    const text = cue.text.replace(pattern, () => {
      count++;
      return replace;
    });
    return text === cue.text ? cue : { ...cue, text };
  });
  return { cues: next, count };
}

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });
export const push = <T>(h: History<T>, next: T): History<T> => ({
  past: [...h.past, h.present].slice(-100),
  present: next,
  future: [],
});
export const undo = <T>(h: History<T>): History<T> =>
  h.past.length === 0
    ? h
    : { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] };
export const redo = <T>(h: History<T>): History<T> =>
  h.future.length === 0
    ? h
    : { past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1) };

/** Cues whose words or timing differ from the approved copy, plus any added or removed. */
export function changesSinceApproval(approved: Cue[], current: Cue[]): number {
  const before = new Map(approved.map((c) => [c.id, c]));
  const now = new Map(current.map((c) => [c.id, c]));
  let changes = 0;
  for (const [id, cue] of now) {
    const old = before.get(id);
    if (!old || old.text !== cue.text || old.start !== cue.start || old.end !== cue.end) changes++;
  }
  for (const id of before.keys()) if (!now.has(id)) changes++;
  return changes;
}

export function toVtt(cues: Cue[]): string {
  const body = cues
    .map(
      (cue, index) =>
        `${index + 1}\n${formatTimestamp(cue.start)} --> ${formatTimestamp(cue.end)}\n${cue.text}`,
    )
    .join('\n\n');
  return `WEBVTT\n\n${body}\n`;
}

export type VttResult = { ok: true; cues: Cue[] } | { ok: false; error: string };

export function parseVtt(source: string, newId: (n: number) => string): VttResult {
  const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!text.trimStart().startsWith('WEBVTT'))
    return { ok: false, error: 'That does not look like a caption file. Use a .vtt file.' };
  const cues: Cue[] = [];
  for (const block of text.split(/\n{2,}/).slice(1)) {
    const lines = block.split('\n').filter((l) => l.length > 0);
    const timing = lines.findIndex((l) => l.includes('-->'));
    if (timing < 0) continue;
    const [from, to] = lines[timing]!.split('-->').map((part) => part.trim().split(/\s+/)[0] ?? '');
    const start = parseTimestamp(from ?? '');
    const end = parseTimestamp(to ?? '');
    if (start === null || end === null) continue;
    cues.push({ id: newId(cues.length + 1), start, end, text: lines.slice(timing + 1).join('\n') });
  }
  return cues.length
    ? { ok: true, cues }
    : { ok: false, error: 'That caption file has no cues in it.' };
}
