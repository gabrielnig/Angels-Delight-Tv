/** A small, safe Markdown subset for help articles. It builds a tree, never HTML, so nothing can inject markup. */
export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; kind: 'help' | 'glossary' | 'admin' | 'external'; href: string; c: Inline[] };

export type CalloutKind = 'tip' | 'careful' | 'note';

export type Block =
  | { t: 'p'; c: Inline[] }
  | { t: 'ul' | 'ol'; items: ListItem[] }
  | { t: 'callout'; kind: CalloutKind; c: Inline[] }
  | { t: 'image'; alt: string; src: string };

export interface ListItem {
  c: Inline[];
  /** Indented text lines under a list item, such as a recorder note. Not part of the one action sentence. */
  note?: Inline[];
  blocks: Block[];
}

const IMAGE_SRC = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*\.(webp|png|jpg|svg)$/i;
/** The recorder writes pictures as ../../media/<id>/<file>. That prefix is stripped, so src is always inside content/help/media. */
const MEDIA_PREFIX = '../../media/';

export function classifyLink(href: string): Extract<Inline, { t: 'link' }>['kind'] {
  if (/^help:[SDWCMKTR]\d{2}(#[a-z0-9-]+)?$/.test(href)) return 'help';
  if (/^glossary:[a-z0-9-]+$/.test(href)) return 'glossary';
  if (/^\/admin(\/[A-Za-z0-9._~[\]/-]*)?(\?[A-Za-z0-9=&._-]*)?(#[a-z0-9-]+)?$/.test(href))
    return 'admin';
  if (/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s)]*)?$/i.test(href)) return 'external';
  throw new Error(
    `Unsafe or unknown link "${href}". Use help:ID, glossary:term, /admin/... or https://...`,
  );
}

/** Inline syntax: **bold**, *italic*, `code`, [text](target). Everything else is plain text. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = '';
  const flush = () => {
    if (text) out.push({ t: 'text', v: text });
    text = '';
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpExecArray | null;
    if ((m = /^`([^`]+)`/.exec(rest))) {
      flush();
      out.push({ t: 'code', v: m[1] as string });
      i += m[0].length;
    } else if ((m = /^\*\*([^*]+)\*\*/.exec(rest))) {
      flush();
      out.push({ t: 'strong', c: parseInline(m[1] as string) });
      i += m[0].length;
    } else if ((m = /^\*([^*\s][^*]*)\*/.exec(rest))) {
      flush();
      out.push({ t: 'em', c: parseInline(m[1] as string) });
      i += m[0].length;
    } else if ((m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest))) {
      flush();
      const href = m[2] as string;
      const kind = classifyLink(href);
      out.push({
        t: 'link',
        kind,
        href: kind === 'help' ? href.slice(5) : kind === 'glossary' ? href.slice(9) : href,
        c: parseInline(m[1] as string),
      });
      i += m[0].length;
    } else {
      text += src[i];
      i += 1;
    }
  }
  flush();
  return out;
}

export function plainText(inlines: Inline[]): string {
  return inlines.map((n) => (n.t === 'text' || n.t === 'code' ? n.v : plainText(n.c))).join('');
}

export function blockText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.t === 'p' || b.t === 'callout') return plainText(b.c);
      if (b.t === 'image') return b.alt;
      return b.items
        .map((it) => `${plainText(it.c)} ${plainText(it.note ?? [])} ${blockText(it.blocks)}`)
        .join(' ');
    })
    .join(' ');
}

function image(line: string): Block | null {
  const m = /^!\[([^\]]*)\]\(([^)\s]*)\)$/.exec(line.trim());
  if (!m) return null;
  const alt = (m[1] as string).trim();
  const written = m[2] as string;
  const src = written.startsWith(MEDIA_PREFIX) ? written.slice(MEDIA_PREFIX.length) : written;
  if (!alt) throw new Error(`Image "${written}" has no alt text. Say what the picture shows.`);
  if (!IMAGE_SRC.test(src))
    throw new Error(
      `Image path "${written}" is not allowed. Use a file name inside content/help/media.`,
    );
  return { t: 'image', alt, src };
}

const CALLOUT = /^>\s*\[!(TIP|CAREFUL|NOTE)\]\s*$/;

/** Blocks separated by blank lines. A list item may hold indented continuation lines, images and callouts. */
export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  const attach = (list: Extract<Block, { t: 'ul' | 'ol' }>, chunk: string[]) => {
    const item = list.items[list.items.length - 1];
    if (!item) return;
    const nested = parseBlocks(chunk.map((l) => l.replace(/^ {2,4}/, '')).join('\n'));
    for (const b of nested) {
      if (b.t === 'p')
        item.note = [
          ...(item.note ?? []),
          ...(item.note ? [{ t: 'text' as const, v: ' ' }] : []),
          ...b.c,
        ];
      else item.blocks.push(b);
    }
  };
  while (i < lines.length) {
    const line = lines[i] ?? '';
    // Blank lines and HTML comments (such as the recorder's kb:steps markers) carry no content.
    if (!line.trim() || /^\s*<!--.*-->\s*$/.test(line)) {
      i += 1;
      continue;
    }
    const img = image(line);
    if (img) {
      blocks.push(img);
      i += 1;
      continue;
    }
    const co = CALLOUT.exec(line.trim());
    if (co) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && /^>/.test(lines[i] ?? '')) {
        body.push((lines[i] as string).replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({
        t: 'callout',
        kind: (co[1] as string).toLowerCase() as CalloutKind,
        c: parseInline(body.join(' ').trim()),
      });
      continue;
    }
    const listStart = /^(\d+\.|-)\s+(.*)$/.exec(line);
    if (listStart) {
      const ordered = listStart[1] !== '-';
      const list: Extract<Block, { t: 'ul' | 'ol' }> = { t: ordered ? 'ol' : 'ul', items: [] };
      while (i < lines.length) {
        const cur = lines[i] ?? '';
        const m = /^(\d+\.|-)\s+(.*)$/.exec(cur);
        if (m && (m[1] !== '-') === ordered) {
          list.items.push({ c: parseInline((m[2] as string).trim()), blocks: [] });
          i += 1;
          const chunk: string[] = [];
          while (
            i < lines.length &&
            /^ {2,}\S/.test(lines[i] ?? '') &&
            !/^\s*<!--/.test(lines[i] ?? '')
          ) {
            chunk.push(lines[i] as string);
            i += 1;
          }
          if (chunk.length) attach(list, chunk);
        } else if (
          !cur.trim() &&
          /^(\d+\.|-)\s+/.test(lines[i + 1] ?? '') &&
          ((/^(\d+\.|-)/.exec(lines[i + 1] ?? '')?.[1] ?? '') !== '-') === ordered
        ) {
          i += 1;
        } else break;
      }
      blocks.push(list);
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() &&
      !/^\s*<!--.*-->\s*$/.test(lines[i] ?? '') &&
      !CALLOUT.test((lines[i] ?? '').trim()) &&
      !/^(\d+\.|-)\s+/.test(lines[i] ?? '') &&
      !image(lines[i] ?? '')
    ) {
      para.push((lines[i] as string).trim());
      i += 1;
    }
    blocks.push({ t: 'p', c: parseInline(para.join(' ')) });
  }
  return blocks;
}
