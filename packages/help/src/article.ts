import { z } from 'zod';
import { parseFrontMatter } from './frontmatter';
import { ARTICLE_ID, HELP_PATH_KEYS, HELP_ROLES, VIDEO_ID, pathByKey } from './ids';
import { blockText, parseBlocks, plainText, type Block, type Inline } from './markdown';

const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const adminRoute = z
  .string()
  .regex(
    /^\/admin(\/[A-Za-z0-9[\]_-]+)*$/,
    'must be an /admin route pattern such as /admin/videos/[id]',
  );

export const frontMatterSchema = z
  .object({
    id: z.string().regex(ARTICLE_ID, 'must be a path letter and two digits, for example D02'),
    title: z.string().min(3).max(80),
    path: z.enum(HELP_PATH_KEYS),
    summary: z
      .string()
      .refine(
        (s) => countWords(s) < 20 && countWords(s) > 0,
        'must be one sentence of under 20 words',
      ),
    role: z.enum(HELP_ROLES),
    roleNote: z.string().max(120).optional(),
    needs: z.array(z.string().regex(ARTICLE_ID)).default([]),
    related: z.array(z.string().regex(ARTICLE_ID)).max(3, 'at most 3 related ids').default([]),
    readMinutes: z.number().int().min(1).max(30),
    watchSeconds: z.number().int().min(1).max(600).optional(),
    video: z
      .object({
        id: z.string().regex(VIDEO_ID),
        phone: z.boolean().default(false),
        /** track: captions are a live WebVTT track. burned: the recording has them drawn in, so the page shows no track. */
        captions: z.enum(['track', 'burned']).default('track'),
      })
      .strict()
      .optional(),
    screens: z.array(adminRoute).default([]),
    actions: z.array(z.string().regex(/^[a-z]+(\.[a-z_]+)+$/)).default([]),
    aliases: z.array(z.string().min(2).max(40)).default([]),
    flow: z.string().regex(ARTICLE_ID).optional(),
    dependsOn: z.array(z.string().min(3)).default([]),
    verifiedAgainst: z.string().min(3).optional(),
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date like 2026-11-25'),
    locale: z.literal('en'),
    status: z.enum(['draft', 'reviewed', 'verified']),
    textOnly: z.boolean().default(false),
  })
  .strict();

export type FrontMatter = z.infer<typeof frontMatterSchema>;

export const SECTION_TITLES = [
  'What you will do',
  'Before you start',
  'Steps',
  'What you should see',
  'If something goes wrong',
] as const;

export interface Step {
  id: string;
  c: Inline[];
  note?: Inline[];
  blocks: Block[];
  text: string;
}
export interface Trouble {
  cause: string;
  fix: Inline[];
}
export interface Article {
  file: string;
  meta: FrontMatter;
  what: Block[];
  before: Block[];
  steps: Step[];
  see: Block[];
  trouble: Trouble[];
  /** Everything a reader can read, joined, for search and lint. */
  text: string;
}

export const slugAnchor = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function parseArticle(file: string, source: string): Article {
  const name = file.split('/').pop() ?? file;
  const fail = (why: string): never => {
    throw new Error(`${file}: ${why}`);
  };
  let parsed: ReturnType<typeof parseFrontMatter>;
  try {
    parsed = parseFrontMatter(source);
  } catch (error) {
    return fail((error as Error).message);
  }
  const result = frontMatterSchema.safeParse(parsed.data);
  if (!result.success) {
    return fail(
      result.error.issues
        .map((i) => `${i.path.join('.') || 'front matter'}: ${i.message}`)
        .join('; '),
    );
  }
  const meta = result.data;

  const letter = meta.id[0] as string;
  const path = pathByKey(meta.path);
  if (!path || path.letter !== letter)
    fail(`id ${meta.id} does not belong to the path "${meta.path}" (letter ${path?.letter})`);
  const folder = file.split('/').slice(-2, -1)[0];
  if (folder !== meta.path) fail(`the folder "${folder}" must be the path "${meta.path}"`);
  if (!new RegExp(`^${meta.id}-[a-z0-9]+(-[a-z0-9]+)*\\.md$`).test(name))
    fail(`the file name must look like ${meta.id}-short-slug.md`);

  if (meta.video) {
    if (meta.video.id !== `V${meta.id}`) fail(`video.id must be V${meta.id}`);
    if (!meta.watchSeconds) fail('watchSeconds is required when the article has a video');
    if (meta.textOnly) fail('textOnly must be false when the article has a video');
  } else if (!meta.textOnly) {
    fail('an article without a video must set textOnly: true');
  }
  if (!meta.video && meta.watchSeconds) fail('watchSeconds is set but there is no video');
  if (meta.status === 'verified' && !meta.verifiedAgainst)
    fail('a verified article needs verifiedAgainst');
  if (meta.needs.includes(meta.id) || meta.related.includes(meta.id))
    fail('an article cannot list itself in needs or related');

  // Sections: exactly the five H2 titles, in order, nothing else at heading level.
  const body = parsed.body.replace(/\r\n/g, '\n');
  const chunks = body.split(/^## /m);
  if (chunks[0]?.trim()) fail('text before the first section. Start with "## What you will do".');
  const sections = chunks.slice(1).map((c) => {
    const nl = c.indexOf('\n');
    return { title: (nl < 0 ? c : c.slice(0, nl)).trim(), body: nl < 0 ? '' : c.slice(nl + 1) };
  });
  for (const t of SECTION_TITLES) {
    if (!sections.some((s) => s.title === t)) fail(`missing the section "${t}"`);
  }
  const titles = sections.map((s) => s.title);
  for (const t of titles)
    if (!(SECTION_TITLES as readonly string[]).includes(t))
      fail(`unknown section "${t}". Allowed: ${SECTION_TITLES.join(', ')}`);
  if (titles.join('|') !== SECTION_TITLES.join('|'))
    fail(`the sections are out of order. Use: ${SECTION_TITLES.join(', ')}`);
  if (/^#{1,6} /m.test(sections.map((s) => s.body).join('\n')))
    fail('only the five "## " section headings are allowed, no other headings');

  const blocks = (title: (typeof SECTION_TITLES)[number]): Block[] => {
    try {
      return parseBlocks(sections.find((s) => s.title === title)?.body ?? '');
    } catch (error) {
      return fail(`${title}: ${(error as Error).message}`);
    }
  };

  const what = blocks('What you will do');
  const before = blocks('Before you start');
  const see = blocks('What you should see');
  const stepBlocks = blocks('Steps');
  const troubleBlocks = blocks('If something goes wrong');
  if (!what.length) fail('"What you will do" is empty');

  const list = stepBlocks.find((b): b is Extract<Block, { t: 'ul' | 'ol' }> => b.t === 'ol');
  if (!list || stepBlocks.length !== 1)
    return fail('the steps section must be one numbered list and nothing else');
  const steps: Step[] = list.items.map((item, n) => ({
    id: `step-${n + 1}`,
    c: item.c,
    note: item.note,
    blocks: item.blocks,
    text: `${plainText(item.c)} ${plainText(item.note ?? [])} ${blockText(item.blocks)}`.trim(),
  }));
  if (!steps.length) fail('the steps section has no steps');

  const tl = troubleBlocks.find((b): b is Extract<Block, { t: 'ul' | 'ol' }> => b.t === 'ul');
  if (!tl || troubleBlocks.length !== 1)
    return fail('"If something goes wrong" must be one bulleted list');
  const trouble: Trouble[] = tl.items.map((item) => {
    const first = item.c[0];
    const cause = first?.t === 'strong' ? plainText(first.c) : plainText(item.c);
    return { cause, fix: first?.t === 'strong' ? item.c.slice(1) : item.c };
  });
  if (trouble.length < 1 || trouble.length > 3)
    fail('"If something goes wrong" needs one to three items');

  const text = [
    meta.title,
    meta.summary,
    meta.aliases.join(' '),
    blockText(what),
    blockText(before),
    ...steps.map((s) => s.text),
    blockText(see),
    ...trouble.map((t) => `${t.cause} ${plainText(t.fix)}`),
  ]
    .filter(Boolean)
    .join('\n');
  return { file, meta, what, before, steps, see, trouble, text };
}
