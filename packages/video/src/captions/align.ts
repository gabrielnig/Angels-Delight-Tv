import { PipelineError } from '../failure';
import type { TimedWord } from '../vtt';

/**
 * Removes speaker labels such as `NARRATOR:`, stage directions in brackets or parentheses, and blank lines
 * (M15-S02 edge). Colons inside a sentence are kept because speaker labels are short, upper case and at the line start.
 */
export function cleanScript(script: string): string {
  return script
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/\[[^\]]*\]/g, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/^\s*[A-Z][A-Z0-9 .'-]{0,24}:\s*/, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((line) => line !== '')
    .join('\n');
}

const normalise = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

export interface AlignResult {
  words: TimedWord[];
  /** Indexes into `words` whose text the recogniser did not hear, for highlighting in review. */
  lowConfidence: number[];
}

const MIN_OVERLAP = 0.4;

/**
 * Alignment stub. It keeps the script wording and borrows timing from the recognised words: one to one when the
 * counts match, otherwise spread across the speech span in proportion to word length. A real forced aligner
 * (stable-ts, see ARCHITECTURE section 9) can replace this behind the same function.
 */
export function alignScript(script: string, recognised: TimedWord[]): AlignResult {
  const tokens = script.split(/\s+/).filter((token) => normalise(token) !== '');
  if (tokens.length === 0 || recognised.length === 0) {
    throw new PipelineError('script_mismatch', 'script or recognised words were empty');
  }

  const heard = new Map<string, number>();
  for (const word of recognised) {
    const key = normalise(word.word);
    heard.set(key, (heard.get(key) ?? 0) + 1);
  }
  const remaining = new Map(heard);
  let matched = 0;
  const unheard: boolean[] = tokens.map((token) => {
    const key = normalise(token);
    const left = remaining.get(key) ?? 0;
    if (left > 0) {
      remaining.set(key, left - 1);
      matched++;
      return false;
    }
    return true;
  });
  if (matched / recognised.length < MIN_OVERLAP) {
    throw new PipelineError(
      'script_mismatch',
      `only ${matched} of ${recognised.length} recognised words found in the script`,
    );
  }

  const start = recognised[0]!.startMs;
  const end = recognised[recognised.length - 1]!.endMs;

  if (tokens.length === recognised.length) {
    return {
      words: tokens.map((word, index) => ({
        word,
        startMs: recognised[index]!.startMs,
        endMs: recognised[index]!.endMs,
      })),
      lowConfidence: unheard.flatMap((flag, index) => (flag ? [index] : [])),
    };
  }

  const weights = tokens.map((token) => token.length + 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = start;
  const words: TimedWord[] = tokens.map((word, index) => {
    const share = Math.round(((end - start) * weights[index]!) / total);
    const wordStart = cursor;
    cursor = index === tokens.length - 1 ? end : Math.min(end, cursor + share);
    return { word, startMs: wordStart, endMs: cursor };
  });
  const flagged = new Set(unheard.flatMap((flag, index) => (flag ? [index] : [])));
  // Counts differ, so every word's timing is an estimate: flag the unheard ones plus neighbours of them.
  for (const index of [...flagged]) {
    if (index > 0) flagged.add(index - 1);
    if (index < tokens.length - 1) flagged.add(index + 1);
  }
  return { words, lowConfidence: [...flagged].sort((a, b) => a - b) };
}
