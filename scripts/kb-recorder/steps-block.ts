import type { Episode } from './episode';

export interface ListedStep {
  n: number;
  text: string;
  note?: string;
  shot?: { name: string; alt: string; scheme?: 'light' | 'dark' };
}

/** The article step list of an episode: one numbered step per caption, with optional notes and pictures. */
export function stepList(e: Episode): ListedStep[] {
  return e.steps.map((s, i) => ({
    n: i + 1,
    text: s.caption,
    note: s.note,
    shot: s.shot
      ? {
          name: s.shot.name,
          alt: s.shot.alt ?? `Step ${i + 1}: ${s.caption}`,
          scheme: s.shot.scheme,
        }
      : undefined,
  }));
}

/** `<id>-<nn>-<name>-<desktop|mobile>.webp`, the media layout of the plan (section 6.1). */
export function shotFileName(
  id: string,
  n: number,
  name: string,
  profile: 'desktop' | 'mobile',
  scheme: 'light' | 'dark' = 'light',
): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${id}-${String(n).padStart(2, '0')}-${slug}-${profile}${scheme === 'dark' ? '-dark' : ''}.webp`;
}

const open = (id: string) => `<!-- kb:steps ${id} -->`;
const close = '<!-- /kb:steps -->';

/**
 * The Markdown steps block for an article: a numbered list between two comment markers. The article body outside
 * the markers is written by hand and never touched. Default picture path is relative to
 * `content/help/en/<path>/<id>-<slug>.md`, so `../../media/<id>/<file>`.
 */
export function renderStepsBlock(e: Episode, o: { mediaPrefix?: string } = {}): string {
  const prefix = o.mediaPrefix ?? '../../media';
  const lines: string[] = [open(e.id)];
  for (const s of stepList(e)) {
    lines.push(`${s.n}. ${s.text}`);
    if (s.note) lines.push(`   ${s.note}`);
    if (s.shot) {
      const file = shotFileName(e.id, s.n, s.shot.name, 'desktop', s.shot.scheme);
      lines.push(`   ![${s.shot.alt}](${prefix}/${e.id}/${file})`);
    }
  }
  lines.push(close);
  return lines.join('\n') + '\n';
}

/** Replaces the block for this episode in an article. Fails when the markers are missing. */
export function applyStepsBlock(doc: string, e: Episode, o: { mediaPrefix?: string } = {}): string {
  const start = doc.indexOf(open(e.id));
  const end = doc.indexOf(close, start);
  if (start === -1 || end === -1) {
    throw new Error(`The article has no ${open(e.id)} ... ${close} markers`);
  }
  const block = renderStepsBlock(e, o).trimEnd();
  return doc.slice(0, start) + block + doc.slice(end + close.length);
}
