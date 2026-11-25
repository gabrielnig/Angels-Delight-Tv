import type { Library } from './library';
import { roleCanDo, type HelpRole } from './ids';

/** Lower case words, punctuation dropped, simple plural stemming. */
export function stem(word: string): string {
  const w = word.toLowerCase();
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

const WORD = /[\p{L}\p{N}]+/gu;

export function tokenize(text: string): string[] {
  return (text.match(WORD) ?? []).map(stem);
}

interface Doc {
  id: string;
  title: string;
  summary: string;
  path: string;
  role: HelpRole;
  idToken: string;
  title_: Set<string>;
  alias: Set<string>;
  summary_: Set<string>;
  text: Set<string>;
}

export interface SearchIndex {
  docs: Doc[];
  vocab: Set<string>;
}

export interface SearchHit {
  id: string;
  title: string;
  summary: string;
  path: string;
  score: number;
  /** The guide needs a higher role than the person has. It stays in the list with a label. */
  higher: boolean;
  roleNeeded: HelpRole;
}

export function buildSearchIndex(library: Library): SearchIndex {
  const vocab = new Set<string>();
  const set = (text: string) => {
    const tokens = tokenize(text);
    for (const t of tokens) vocab.add(t);
    return new Set(tokens);
  };
  const docs = library.articles.map((a): Doc => {
    const m = a.meta;
    return {
      id: m.id,
      title: m.title,
      summary: m.summary,
      path: m.path,
      role: m.role,
      idToken: m.id.toLowerCase(),
      title_: set(m.title),
      alias: set(m.aliases.join(' ')),
      summary_: set(m.summary),
      text: set(a.text),
    };
  });
  return { docs, vocab };
}

function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        (prev[j] as number) + 1,
        (row[j - 1] as number) + 1,
        (prev[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length] as number;
}

const FUZZY_MIN = 5;
const FIELD = { title: 10, alias: 8, summary: 4, text: 1 } as const;

function expand(index: SearchIndex, token: string): { word: string; weight: number }[] {
  if (index.vocab.has(token)) return [{ word: token, weight: 1 }];
  if (token.length < FUZZY_MIN) return [];
  const out: { word: string; weight: number }[] = [];
  for (const v of index.vocab) if (distance(token, v, 1) <= 1) out.push({ word: v, weight: 0.7 });
  return out;
}

function suggest(index: SearchIndex, tokens: string[]): string | undefined {
  let changed = false;
  const words = tokens.map((t) => {
    if (index.vocab.has(t) || t.length < 4) return t;
    let best: string | null = null;
    let bestD = 3;
    for (const v of index.vocab) {
      const d = distance(t, v, 2);
      if (d < bestD) {
        best = v;
        bestD = d;
      }
    }
    if (best) changed = true;
    return best ?? t;
  });
  return changed ? words.join(' ') : undefined;
}

export function search(
  index: SearchIndex,
  query: string,
  options: { role: HelpRole },
): { results: SearchHit[]; didYouMean?: string } {
  const tokens = tokenize(query);
  if (tokens.length === 0) return { results: [] };
  const expanded = tokens.map((t) => ({ token: t, words: expand(index, t) }));
  const hits: SearchHit[] = [];
  for (const d of index.docs) {
    let score = 0;
    for (const { token, words } of expanded) {
      if (d.idToken === token) score += 20;
      let best = 0;
      for (const { word, weight } of words) {
        const f = d.title_.has(word)
          ? FIELD.title
          : d.alias.has(word)
            ? FIELD.alias
            : d.summary_.has(word)
              ? FIELD.summary
              : d.text.has(word)
                ? FIELD.text
                : 0;
        best = Math.max(best, f * weight);
      }
      score += best;
    }
    if (score > 0)
      hits.push({
        id: d.id,
        title: d.title,
        summary: d.summary,
        path: d.path,
        score,
        higher: !roleCanDo(options.role, d.role),
        roleNeeded: d.role,
      });
  }
  hits.sort(
    (a, b) => Number(a.higher) - Number(b.higher) || b.score - a.score || a.id.localeCompare(b.id),
  );
  if (hits.length > 0) return { results: hits };
  const didYouMean = suggest(index, tokens);
  return didYouMean ? { results: [], didYouMean } : { results: [] };
}

export interface Segment {
  text: string;
  match: boolean;
}

/** Splits text into plain and matching pieces, for a mark around each word the person searched for. */
export function highlight(text: string, query: string): Segment[] {
  const wanted = new Set(tokenize(query));
  const out: Segment[] = [];
  const push = (t: string, match: boolean) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && last.match === match) last.text += t;
    else out.push({ text: t, match });
  };
  let at = 0;
  for (const m of text.matchAll(WORD)) {
    const i = m.index as number;
    push(text.slice(at, i), false);
    push(m[0], wanted.has(stem(m[0])));
    at = i + m[0].length;
  }
  push(text.slice(at), false);
  return out;
}
