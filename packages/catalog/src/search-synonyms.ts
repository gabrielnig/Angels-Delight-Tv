import { sql } from 'drizzle-orm';
import type { Tx } from './types';
import { rowsOf } from './sql';

/**
 * Synonym groups (M45-S08). One group per line, words separated by commas. A group lets a search for any of its
 * words also find titles that use the others, ranked below exact matches. At most 8 expansions per query.
 */
export const MAX_EXPANSIONS = 8;
export const MAX_GROUP_TERMS = 20;
const MAX_TERM_LENGTH = 40;

export interface SynonymLineError {
  line: number;
  message: string;
}

export function normalizeTerm(term: string): string {
  return term
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const TERM_SHAPE = /^[\p{L}\p{N}]+(?: [\p{L}\p{N}]+)*$/u;

export function parseSynonymGroups(text: string): {
  groups: string[][];
  errors: SynonymLineError[];
} {
  const groups: string[][] = [];
  const errors: SynonymLineError[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    if (raw.trim() === '') return;
    const line = index + 1;
    const terms = [...new Set(raw.split(',').map(normalizeTerm).filter(Boolean))];
    if (terms.some((t) => t.length > MAX_TERM_LENGTH || !TERM_SHAPE.test(t))) {
      errors.push({ line, message: 'Use letters and numbers only, up to 40 characters a word' });
    } else if (terms.length < 2) {
      errors.push({ line, message: 'Add at least two different words' });
    } else if (terms.length > MAX_GROUP_TERMS) {
      errors.push({ line, message: `Use at most ${MAX_GROUP_TERMS} words in a group` });
    } else {
      groups.push(terms);
    }
  });
  return { groups, errors };
}

/** The other words of each group a token belongs to, at most `MAX_EXPANSIONS` in total. */
export function expansionsFor(groups: string[][], tokens: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let room = MAX_EXPANSIONS;
  for (const token of tokens) {
    const key = normalizeTerm(token);
    const found: string[] = [];
    for (const group of groups) {
      if (!group.includes(key)) continue;
      for (const term of group) if (term !== key && !found.includes(term)) found.push(term);
    }
    const take = found.slice(0, room);
    if (take.length > 0) out[token] = take;
    room -= take.length;
    if (room <= 0) break;
  }
  return out;
}

export async function loadSynonymGroups(tx: Tx): Promise<string[][]> {
  const rows = rowsOf<{ terms: string[] }>(
    await tx.execute(sql`SELECT terms FROM search_synonyms`),
  );
  return rows.map((row) => row.terms);
}

const asQuery = (term: string, prefix: boolean) => {
  const words = term.split(' ');
  return words.length === 1 ? `${words[0]}${prefix ? ':*' : ''}` : `(${words.join(' & ')})`;
};

/**
 * The tsquery text for a search. Every typed token is a prefix match, and a token that sits in a synonym group
 * becomes an OR of itself and the other words. `exact` is the same query without synonyms, used to rank exact
 * matches above synonym matches.
 */
export function buildTsQueries(
  tokens: string[],
  groups: string[][],
): { expanded: string; exact: string } {
  const expansions = expansionsFor(groups, tokens);
  const exact = tokens.map((token) => `${token}:*`).join(' & ');
  const expanded = tokens
    .map((token) => {
      const extra = expansions[token];
      if (!extra) return `${token}:*`;
      return `(${[`${token}:*`, ...extra.map((term) => asQuery(term, false))].join(' | ')})`;
    })
    .join(' & ');
  return { expanded, exact };
}
