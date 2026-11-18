import type { LegalPage } from '../data/types';

const PLACEHOLDER = /\[Add your [^\]]* here before launch\]/;
const WORDS_PER_MINUTE = 220;

function decode(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function slugOf(heading: string): string {
  const slug = heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

/** Lagos is UTC+1 all year. Shown as `17 Nov 2026`. */
function lagosDate(iso: string): string {
  const d = new Date(Date.parse(iso) + 60 * 60 * 1000);
  const month = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ][d.getUTCMonth()];
  return `${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
}

/**
 * A published page (already sanitised to a small tag set by @ad/theme) as the legal page view model: ids on
 * the h2 headings, a contents list from them, a last updated date and a reading time. Pages that still hold
 * the launch placeholder count as drafts so the banner shows (M26-S01 AC3).
 */
export function legalFromHtml(input: {
  slug: LegalPage['slug'];
  title: string;
  html: string;
  updatedAt: string;
}): LegalPage {
  const seen = new Map<string, number>();
  const sections: LegalPage['sections'] = [];
  const html = input.html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_m, inner: string) => {
    const heading = decode(inner.replace(/<[^>]+>/g, '').trim());
    const base = slugOf(heading);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    const id = count === 1 ? base : `${base}-${count}`;
    sections.push({ id, heading, body: [] });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  const words = decode(input.html.replace(/<[^>]+>/g, ' '))
    .split(/\s+/)
    .filter(Boolean).length;
  return {
    slug: input.slug,
    title: input.title,
    updated: lagosDate(input.updatedAt),
    readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    draft: PLACEHOLDER.test(input.html),
    sections,
    html,
  };
}
