import { PipelineError } from '../failure';
import { cuesFromWords, type Cue, type TimedWord } from '../vtt';

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

const normalise = (word: string) =>
  word
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[\u2018\u2019\u02bc`]/g, "'")
    .replace(/[^\p{L}\p{N}']/gu, '')
    .replace(/^'+|'+$/g, '');

export interface AlignResult {
  /** Script wording with timing from the audio. One entry per script word, never reordered. */
  words: TimedWord[];
  /** Indexes into `words` the review screen should highlight: not heard, guessed, or recognised with low probability. */
  lowConfidence: number[];
  /** Share of the shorter of script and audio that lined up word for word, 0 to 1. */
  matchRatio: number;
}

export interface AlignOptions {
  /** Whisper word probability below this flags the word. Default 0.45. */
  minProbability?: number;
}

const MIN_OVERLAP = 0.4;
const MIN_PROBABILITY = 0.45;
/** Edit distance ratio at which two spellings count as the same word, for names and plurals. */
const FUZZY = 0.75;
const GUESS_WORD_MS = 300;
/** Cell budget for the alignment table. About 4500 words each side, a 30 minute video. */
const MAX_CELLS = 36_000_000;

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 4 || b.length < 4) return 0;
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const row = [i];
    for (let j = 1; j <= n; j++) {
      row[j] = Math.min(
        prev[j]! + 1,
        row[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return 1 - prev[n]! / Math.max(m, n);
}

const MATCH = 3;
const FUZZY_SCORE = 1;
const SUBSTITUTE = -1;
const GAP = -1;

type Step = 0 | 1 | 2; // 0 diagonal (match or substitute), 1 script word not heard, 2 extra heard word

interface Pair {
  script: number;
  heard: number;
  kind: 'match' | 'fuzzy' | 'substitute';
}

/** Global alignment of two word lists (Needleman and Wunsch) that keeps order and tolerates misses on both sides. */
function pairWords(scriptKeys: string[], heardKeys: string[]): Pair[] {
  const n = scriptKeys.length;
  const m = heardKeys.length;
  if ((n + 1) * (m + 1) > MAX_CELLS) {
    throw new PipelineError(
      'caption_failed',
      `script and audio too long to align (${n} by ${m} words)`,
      true,
    );
  }
  const steps = new Uint8Array((n + 1) * (m + 1));
  const width = m + 1;
  let prev = new Float32Array(width);
  let row = new Float32Array(width);
  for (let j = 1; j <= m; j++) {
    prev[j] = j * GAP;
    steps[j] = 2;
  }
  for (let i = 1; i <= n; i++) {
    row[0] = i * GAP;
    steps[i * width] = 1;
    for (let j = 1; j <= m; j++) {
      const sim = similarity(scriptKeys[i - 1]!, heardKeys[j - 1]!);
      const pairScore = sim === 1 ? MATCH : sim >= FUZZY ? FUZZY_SCORE : SUBSTITUTE;
      const diagonal = prev[j - 1]! + pairScore;
      const skipScript = prev[j]! + GAP;
      const skipHeard = row[j - 1]! + GAP;
      let best = diagonal;
      let step: Step = 0;
      if (skipScript > best) {
        best = skipScript;
        step = 1;
      }
      if (skipHeard > best) {
        best = skipHeard;
        step = 2;
      }
      row[j] = best;
      steps[i * width + j] = step;
    }
    [prev, row] = [row, prev];
  }

  const pairs: Pair[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const step: Step = i === 0 ? 2 : j === 0 ? 1 : (steps[i * width + j] as Step);
    if (step === 0) {
      const sim = similarity(scriptKeys[i - 1]!, heardKeys[j - 1]!);
      pairs.push({
        script: i - 1,
        heard: j - 1,
        kind: sim === 1 ? 'match' : sim >= FUZZY ? 'fuzzy' : 'substitute',
      });
      i--;
      j--;
    } else if (step === 1) i--;
    else j--;
  }
  return pairs.reverse();
}

/**
 * Forced alignment of a script to recognised words with timestamps. The result keeps every script word in order:
 * words the recogniser heard take its timing, and words it missed are placed between their neighbours in proportion to
 * their length. Anything guessed or heard with low probability is flagged for review (M15-S02 AC2).
 */
export function alignScript(
  script: string,
  recognised: TimedWord[],
  options: AlignOptions = {},
): AlignResult {
  const tokens = script.split(/\s+/).filter((token) => normalise(token) !== '');
  if (tokens.length === 0 || recognised.length === 0) {
    throw new PipelineError('script_mismatch', 'script or recognised words were empty');
  }
  const minProbability = options.minProbability ?? MIN_PROBABILITY;
  const pairs = pairWords(
    tokens.map(normalise),
    recognised.map((w) => normalise(w.word)),
  );

  const lined = pairs.filter((pair) => pair.kind !== 'substitute').length;
  const matchRatio = lined / Math.min(tokens.length, recognised.length);
  if (matchRatio < MIN_OVERLAP) {
    throw new PipelineError(
      'script_mismatch',
      `only ${lined} of ${Math.min(tokens.length, recognised.length)} words lined up between script and audio`,
    );
  }

  const start: (number | undefined)[] = new Array(tokens.length);
  const end: (number | undefined)[] = new Array(tokens.length);
  const low: boolean[] = new Array(tokens.length).fill(true);
  for (const pair of pairs) {
    const heard = recognised[pair.heard]!;
    start[pair.script] = heard.startMs;
    end[pair.script] = heard.endMs;
    const unsure = heard.confidence !== undefined && heard.confidence < minProbability;
    low[pair.script] = pair.kind === 'substitute' || unsure;
  }

  // Words with no heard partner sit in runs between timed neighbours. Spread each run across its gap.
  let index = 0;
  while (index < tokens.length) {
    if (start[index] !== undefined) {
      index++;
      continue;
    }
    const runStart = index;
    while (index < tokens.length && start[index] === undefined) index++;
    const count = index - runStart;
    const before = runStart > 0 ? end[runStart - 1]! : null;
    const after = index < tokens.length ? start[index]! : null;
    let from: number;
    let to: number;
    if (before !== null && after !== null) {
      from = before;
      to = Math.max(after, before);
    } else if (before !== null) {
      from = before;
      to = before + count * GUESS_WORD_MS;
    } else {
      to = after ?? count * GUESS_WORD_MS;
      from = Math.max(0, to - count * GUESS_WORD_MS);
    }
    const weights = tokens.slice(runStart, index).map((token) => token.length + 1);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = from;
    for (let k = 0; k < count; k++) {
      const share = Math.round(((to - from) * weights[k]!) / total);
      start[runStart + k] = cursor;
      cursor = k === count - 1 ? to : cursor + share;
      end[runStart + k] = cursor;
    }
  }

  // Timing never runs backwards, even when a guessed run had less room than it needed.
  const words: TimedWord[] = [];
  let clock = 0;
  for (let k = 0; k < tokens.length; k++) {
    const wordStart = Math.max(start[k]!, clock);
    const wordEnd = Math.max(end[k]!, wordStart);
    words.push({ word: tokens[k]!, startMs: wordStart, endMs: wordEnd });
    clock = wordStart;
  }
  return { words, lowConfidence: low.flatMap((flag, k) => (flag ? [k] : [])), matchRatio };
}

/** Cues with the start times of the ones that hold a flagged word, so the review screen can highlight them. */
export function cuesFromAlignment(result: AlignResult): {
  cues: Cue[];
  lowConfidenceStarts: number[];
} {
  const cues = cuesFromWords(result.words);
  const flagged = result.lowConfidence.map((k) => result.words[k]!);
  const lowConfidenceStarts = cues
    .filter((cue) => flagged.some((w) => w.startMs >= cue.startMs && w.startMs <= cue.endMs))
    .map((cue) => cue.startMs);
  return { cues, lowConfidenceStarts };
}
