import { PipelineError } from '../../failure';
import type { Translator } from './types';

const BATCH = 20;

export interface BatchOptions {
  source: string;
  target: string;
  maxChars?: number;
}

/** Translate cue texts in batches. Output always has one entry per input cue. */
export async function translateTexts(t: Translator, texts: string[], o: BatchOptions) {
  if (!t.supports(o.source, o.target)) {
    throw new PipelineError('caption_failed', `${t.name} does not support ${o.source} to ${o.target}`, true);
  }
  const total = texts.reduce((n, s) => n + s.length, 0);
  if (o.maxChars !== undefined && total > o.maxChars) {
    throw new PipelineError('caption_failed', `job of ${total} characters is over the limit of ${o.maxChars}`, true);
  }
  const out: string[] = new Array(texts.length).fill('');
  let model = '';
  let chars = 0;
  const run = async (idx: number[]) => {
    const part = idx.map((i) => texts[i] as string);
    const res = await t.translate({ source: o.source, target: o.target, texts: part });
    model = res.model;
    chars += res.chars;
    return res.texts;
  };
  for (let s = 0; s < texts.length; s += BATCH) {
    const idx = Array.from({ length: Math.min(BATCH, texts.length - s) }, (_, k) => s + k);
    const res = await run(idx);
    if (res.length === idx.length) {
      idx.forEach((i, k) => (out[i] = res[k] as string));
      continue;
    }
    for (const i of idx) {
      const one = await run([i]);
      out[i] = one.length === 1 ? (one[0] as string) : (texts[i] as string);
    }
  }
  return { texts: out, model, chars };
}
