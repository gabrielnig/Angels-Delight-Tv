import type { Article } from './article';
import type { GlossaryTerm } from './glossary';
import { HELP_PATHS, type HelpPathKey } from './ids';
import type { Block, Inline } from './markdown';
import { bestScreenMatch, matchScreen } from './routes';

export interface HelpPath {
  key: HelpPathKey;
  letter: string;
  title: string;
  lead: string;
  articles: Article[];
  videoCount: number;
  readMinutes: number;
  watchSeconds: number;
}

export interface Library {
  articles: Article[];
  byId: Map<string, Article>;
  paths: HelpPath[];
  glossary: GlossaryTerm[];
  nextOf(id: string): Article | null;
  prevOf(id: string): Article | null;
  /** Articles that explain a page, main one first. Dynamic routes match by pattern. */
  forScreen(pathname: string): Article[];
  /** Pattern to article ids, in sorted pattern order. This is the route to article map. */
  screenMap(): Record<string, string[]>;
}

function helpLinks(blocks: Block[], out: string[]): void {
  const walk = (inlines: Inline[]) => {
    for (const n of inlines) {
      if (n.t === 'link') {
        if (n.kind === 'help') out.push(n.href.split('#')[0] as string);
        walk(n.c);
      } else if (n.t === 'strong' || n.t === 'em') walk(n.c);
    }
  };
  for (const b of blocks) {
    if (b.t === 'p' || b.t === 'callout') walk(b.c);
    else if (b.t === 'ul' || b.t === 'ol') {
      for (const it of b.items) {
        walk(it.c);
        helpLinks(it.blocks, out);
      }
    }
  }
}

/** Joins the parsed articles into one library and checks every link between them. Throws one error listing every problem. */
export function buildLibrary(input: Article[], glossary: GlossaryTerm[] = []): Library {
  const problems: string[] = [];
  const byId = new Map<string, Article>();
  for (const a of input) {
    const seen = byId.get(a.meta.id);
    if (seen) problems.push(`${a.meta.id} appears twice: ${seen.file} and ${a.file}`);
    else byId.set(a.meta.id, a);
  }
  const order = (a: Article) => HELP_PATHS.findIndex((p) => p.key === a.meta.path);
  const articles = [...byId.values()].sort(
    (x, y) => order(x) - order(y) || x.meta.id.localeCompare(y.meta.id),
  );

  const check = (a: Article, id: string, where: string) => {
    if (!byId.has(id)) problems.push(`${a.file}: ${where} points to ${id}, which does not exist`);
  };
  for (const a of articles) {
    a.meta.needs.forEach((id) => check(a, id, 'needs'));
    a.meta.related.forEach((id) => check(a, id, 'related'));
    const links: string[] = [];
    helpLinks([...a.what, ...a.before, ...a.see], links);
    a.steps.forEach((s) => helpLinks([{ t: 'p', c: s.c }, ...s.blocks], links));
    a.trouble.forEach((t) => helpLinks([{ t: 'p', c: t.fix }], links));
    links.forEach((id) => check(a, id, 'a link'));
  }
  for (const g of glossary)
    for (const id of g.guides)
      if (!byId.has(id))
        problems.push(`glossary "${g.term}" points to ${id}, which does not exist`);
  if (problems.length) throw new Error(`Help library problems:\n- ${problems.join('\n- ')}`);

  const paths: HelpPath[] = HELP_PATHS.map((p) => {
    const list = articles.filter((a) => a.meta.path === p.key);
    return {
      key: p.key,
      letter: p.letter,
      title: p.title,
      lead: p.lead,
      articles: list,
      videoCount: list.filter((a) => a.meta.video).length,
      readMinutes: list.reduce((n, a) => n + a.meta.readMinutes, 0),
      watchSeconds: list.reduce((n, a) => n + (a.meta.watchSeconds ?? 0), 0),
    };
  }).filter((p) => p.articles.length > 0);

  const patterns = new Map<string, string[]>();
  for (const a of articles) {
    a.meta.screens.forEach((pattern) => {
      const ids = patterns.get(pattern) ?? [];
      ids.push(a.meta.id);
      patterns.set(pattern, ids);
    });
  }
  // The main article for a screen is the one that lists it first.
  const rank = (pattern: string, id: string) => (byId.get(id)?.meta.screens[0] === pattern ? 0 : 1);
  const screens = new Map<string, string[]>(
    [...patterns.entries()]
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([pattern, ids]) => [
        pattern,
        [...ids].sort((x, y) => rank(pattern, x) - rank(pattern, y) || x.localeCompare(y)),
      ]),
  );

  const pathOf = (id: string) => paths.find((p) => p.articles.some((a) => a.meta.id === id));
  return {
    articles,
    byId,
    paths,
    glossary,
    nextOf(id) {
      const list = pathOf(id)?.articles ?? [];
      const i = list.findIndex((a) => a.meta.id === id);
      return i >= 0 ? (list[i + 1] ?? null) : null;
    },
    prevOf(id) {
      const list = pathOf(id)?.articles ?? [];
      const i = list.findIndex((a) => a.meta.id === id);
      return i > 0 ? (list[i - 1] ?? null) : null;
    },
    forScreen(pathname) {
      const hit = bestScreenMatch([...screens.keys()], pathname);
      if (!hit) return [];
      return (screens.get(hit) ?? [])
        .map((id) => byId.get(id))
        .filter((a): a is Article => Boolean(a));
    },
    screenMap() {
      return Object.fromEntries(screens);
    },
  };
}

export { matchScreen };
