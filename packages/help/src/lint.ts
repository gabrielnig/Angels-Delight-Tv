import { plainText, type Block, type Inline } from './markdown';
import type { Article } from './article';

/** Words a secondary school student may not know. A label quoted from the screen (bold, code or in quotes) is exempt. */
export const BANNED_WORDS = [
  'utilize',
  'leverage',
  'simply',
  'obviously',
  'api',
  'backend',
  'frontend',
  'payload',
  'endpoint',
  'parameter',
  'repository',
  'deploy',
  'latency',
  'asynchronous',
  'webhook',
  'cron',
  'stack trace',
];

const DASH = /[\u2013\u2014]/;
const EMOJI = /[\u{2600}-\u{27BF}\u{2B50}-\u{2B55}\u{1F000}-\u{1F2FF}\u{1F300}-\u{1FAFF}]/u;
export const MAX_STEP_WORDS = 25;

export function lintText(text: string): string[] {
  const problems: string[] = [];
  if (DASH.test(text)) problems.push('has an en or em dash, use a full stop or a comma');
  if (EMOJI.test(text)) problems.push('has an emoji');
  const unquoted = text
    .replace(/\*\*[^*]+\*\*/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/"[^"]+"/g, ' ');
  for (const word of BANNED_WORDS) {
    if (new RegExp(`(^|[^a-z])${word}([^a-z]|$)`, 'i').test(unquoted))
      problems.push(`uses the word "${word}", pick a plainer one`);
  }
  return problems;
}

const labelFree = (inlines: Inline[]): string =>
  inlines
    .map((n) => {
      if (n.t === 'text') return n.v;
      if (n.t === 'strong') return `**${plainText(n.c)}**`;
      if (n.t === 'code') return `\`${n.v}\``;
      return labelFree(n.c);
    })
    .join('');

const blocksSource = (blocks: Block[]): string =>
  blocks
    .map((b) => {
      if (b.t === 'p' || b.t === 'callout') return labelFree(b.c);
      if (b.t === 'image') return b.alt;
      return b.items.map((i) => `${labelFree(i.c)} ${blocksSource(i.blocks)}`).join(' ');
    })
    .join('\n');

/** Plain English rules from plan L14 section 5.2 that a machine can check. Returns readable problems, empty when clean. */
export function lintArticle(a: Article): string[] {
  const out: string[] = [];
  const add = (where: string, text: string) => {
    for (const p of lintText(text)) out.push(`${a.file}: ${where} ${p}`);
  };
  add('title', a.meta.title);
  add('summary', a.meta.summary);
  add('"What you will do"', blocksSource(a.what));
  add('"Before you start"', blocksSource(a.before));
  add('"What you should see"', blocksSource(a.see));
  a.steps.forEach((s, i) => {
    const words = plainText(s.c).trim().split(/\s+/).filter(Boolean).length;
    if (words > MAX_STEP_WORDS)
      out.push(`${a.file}: step ${i + 1} has ${words} words, the limit is ${MAX_STEP_WORDS}`);
    add(`step ${i + 1}`, `${labelFree(s.c)} ${labelFree(s.note ?? [])} ${blocksSource(s.blocks)}`);
  });
  a.trouble.forEach((t, i) => add(`problem ${i + 1}`, `${t.cause} ${labelFree(t.fix)}`));
  return out;
}
