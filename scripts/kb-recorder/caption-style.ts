import type { Cue } from './captions';
import { MAX_LINE, readingTimeMs, wrapCaption } from './captions';

export { wrapCaption };

/** The caption style guide of plan section 5.3 and the writing rules of section 5.2, as checks. */
export { MAX_LINE };
export const MAX_LINES = 2;
export const MAX_WORDS = 20;
export const MAX_CPS = 15;
export const MIN_CUE_MS = 2000;
export const MAX_CUE_MS = 6000;

/** Plain words for the hard ones (plan 5.2). A quoted or bold label is exempt, because labels are exact. */
const JARGON = [
  'bitrate',
  'transcode',
  'transcoding',
  'webvtt',
  'codec',
  'hls',
  'cdn',
  'api',
  'json',
  'regex',
  'uuid',
  'payload',
  'endpoint',
  'backend',
  'frontend',
];

const ACTION_VERBS = [
  'click',
  'choose',
  'type',
  'tick',
  'untick',
  'drag',
  'wait',
  'check',
  'open',
  'scroll',
  'select',
  'enter',
  'press',
  'read',
  'look',
  'find',
  'go',
  'watch',
  'see',
  'use',
  'add',
  'save',
  'pick',
  'copy',
  'download',
  'upload',
  'turn',
  'switch',
  'close',
  'sign',
  'confirm',
  'search',
  'point',
  'move',
  'review',
  'edit',
  'set',
  'keep',
  'notice',
  'tap',
  'start',
  'finish',
  'repeat',
  'visit',
  'return',
  'try',
  'print',
  'fill',
  'leave',
  'automatic',
];

const EMOJI = /(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}-\u{2B55}]|\u{FE0F})/u;
const DASHES = /[-‐-―−]/;

/** The text with quoted and bold labels removed, for checks that exempt labels. */
const withoutLabels = (t: string) => t.replace(/\*\*[^*]+\*\*/g, ' ').replace(/"[^"]*"/g, ' ');

export interface CaptionReport {
  errors: string[];
  warnings: string[];
  readingMs: number;
}

/** Checks one caption (a step line). Errors fail the build, warnings are advice. */
export function lintCaption(text: string): CaptionReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const t = text.trim();
  if (t === '') return { errors: ['caption is empty'], warnings, readingMs: 0 };

  if (DASHES.test(t)) errors.push('has a dash: use a comma, a full stop or "to"');
  if (EMOJI.test(t)) errors.push('has an emoji');
  if (t.includes('!')) errors.push('has an exclamation mark');
  if (!/^[A-Z0-9"*]/.test(t)) errors.push('does not start with a capital letter');
  if (!/[.?]$/.test(t)) errors.push('does not end with a full stop');

  const plain = withoutLabels(t);
  if (/\b[A-Z]{5,}\b/.test(plain)) errors.push('uses ALL CAPITALS: write it in sentence case');
  const lower = plain.toLowerCase();
  for (const w of JARGON) {
    if (new RegExp(`\\b${w}\\b`).test(lower))
      errors.push(`uses the jargon word "${w}": use a plain word`);
  }
  if (
    /\b(and then|then)\b/i.test(plain) ||
    /\b(click|choose|select|press|type)\b[^.]*\band\b[^.]*\b(click|choose|select|press|type)\b/i.test(
      plain,
    )
  ) {
    errors.push('has more than one action: one action per step');
  }
  const words = t.split(/\s+/).length;
  if (words > MAX_WORDS) errors.push(`has ${words} words, the most is ${MAX_WORDS}`);
  const wrapped = wrapCaption(t);
  const lines = wrapped.split('\n');
  if (lines.length > MAX_LINES || lines.some((l) => l.length > MAX_LINE)) {
    errors.push(`does not fit on two lines of ${MAX_LINE} characters`);
  }

  const first = t
    .replace(/^["*]+/, '')
    .split(/\s+/)[0]!
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (!ACTION_VERBS.includes(first)) {
    warnings.push(
      `starts with "${first}", not a verb of the step list (Click, Type, Choose, Wait, Check)`,
    );
  }
  return { errors, warnings, readingMs: readingTimeMs(t) };
}

/** Timing and shape checks of the burned in cues (plan 5.3): 2 to 6 seconds, 15 characters a second, two lines of 42. */
export function lintCues(cues: Cue[]): string[] {
  const problems: string[] = [];
  cues.forEach((c, i) => {
    const n = `cue ${i + 1}`;
    const ms = c.endMs - c.startMs;
    const lines = c.text.split('\n');
    const chars = c.text.replace(/\n/g, ' ').length;
    if (ms < MIN_CUE_MS) problems.push(`${n} is on screen for ${ms} ms, at least ${MIN_CUE_MS} ms`);
    if (ms > MAX_CUE_MS) problems.push(`${n} is on screen for ${ms} ms, at most ${MAX_CUE_MS} ms`);
    if (chars / (ms / 1000) > MAX_CPS) {
      problems.push(
        `${n} reads at ${(chars / (ms / 1000)).toFixed(1)} characters a second, the most is ${MAX_CPS}`,
      );
    }
    if (lines.length > MAX_LINES)
      problems.push(`${n} has ${lines.length} lines, the most is two lines`);
    if (lines.some((l) => l.length > MAX_LINE))
      problems.push(`${n} has a line over ${MAX_LINE} characters`);
  });
  return problems;
}
