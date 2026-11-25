import { ARTICLE_ID } from './ids';
import { parseInline, type Inline } from './markdown';

export interface GlossaryTerm {
  term: string;
  slug: string;
  definition: Inline[];
  guides: string[];
  aliases: string[];
}

const slugOf = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** content/help/en/glossary.md: "## Term", a definition line, then optional "Guides: D06, W05" and "Aliases: a, b" lines. */
export function parseGlossary(source: string): GlossaryTerm[] {
  const chunks = source.replace(/\r\n/g, '\n').split(/^## /m).slice(1);
  const seen = new Set<string>();
  const terms = chunks.map((chunk) => {
    const [head, ...rest] = chunk.split('\n');
    const term = (head ?? '').trim();
    const slug = slugOf(term);
    if (!slug) throw new Error('Glossary: a heading has no term.');
    if (seen.has(slug)) throw new Error(`Glossary: "${term}" appears twice.`);
    seen.add(slug);
    let guides: string[] = [];
    let aliases: string[] = [];
    const def: string[] = [];
    for (const line of rest) {
      const g = /^Guides:\s*(.*)$/.exec(line);
      const a = /^Aliases:\s*(.*)$/.exec(line);
      if (g) {
        guides = (g[1] ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        for (const id of guides)
          if (!ARTICLE_ID.test(id))
            throw new Error(`Glossary "${term}": "${id}" is not a guide id.`);
      } else if (a)
        aliases = (a[1] ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      else if (line.trim()) def.push(line.trim());
    }
    if (!def.length) throw new Error(`Glossary "${term}": the definition is empty.`);
    return { term, slug, definition: parseInline(def.join(' ')), guides, aliases };
  });
  return terms.sort((x, y) => x.term.localeCompare(y.term, 'en'));
}
