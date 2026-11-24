import type { RowKind, ViewAllMode } from './enums';

export type { ViewAllMode };

/** Words the four /browse list pages own, so a category cannot take them (D-278). */
export const RESERVED_LIST_SLUGS: ReadonlySet<string> = new Set(['new', 'trending', 'series', 'row']);

export const VIEW_ALL_URL_MESSAGE = 'Use a path on this site or an https link';
const MAX_URL = 300;

/** A custom View all value is a path on this site or an https link. Null when it is fine. */
export function viewAllUrlProblem(url: string): string | null {
  const ok =
    url.length > 0 &&
    url.length <= MAX_URL &&
    !/[\s\\]/.test(url) &&
    (/^\/(?!\/)/.test(url) || /^https:\/\/[^/]/.test(url));
  return ok ? null : VIEW_ALL_URL_MESSAGE;
}

export interface ViewAllInput {
  kind: RowKind;
  mode: ViewAllMode;
  url: string | null;
  categorySlug?: string | null;
  /** Slug of the series a series section follows. */
  seriesSlug?: string | null;
  /** Slug of a manual section. */
  rowSlug?: string | null;
}

export interface ViewAllTarget {
  href: string;
  external: boolean;
}

function autoHref(input: ViewAllInput): string | null {
  switch (input.kind) {
    case 'recently_added':
      return '/browse/new';
    case 'popular':
      return '/browse/trending';
    case 'all_series':
      return '/browse/series';
    case 'my_list':
      return '/my-list';
    case 'category':
      return input.categorySlug ? `/browse/${input.categorySlug}` : null;
    case 'curated':
      if (input.seriesSlug) return `/series/${input.seriesSlug}`;
      return input.rowSlug ? `/browse/row/${input.rowSlug}` : null;
    default:
      return null;
  }
}

/** Where a section's View all link goes, or null when it shows none (M41-S08). */
export function resolveViewAll(input: ViewAllInput): ViewAllTarget | null {
  if (input.mode === 'none') return null;
  if (input.mode === 'custom') {
    if (!input.url || viewAllUrlProblem(input.url)) return null;
    return { href: input.url, external: input.url.startsWith('https://') };
  }
  const href = autoHref(input);
  return href ? { href, external: false } : null;
}

const AUTO_WORDS: Partial<Record<RowKind, string>> = {
  recently_added: 'All new videos',
  popular: 'Trending',
  all_series: 'All series',
  my_list: 'My List',
};

const titleCase = (slug: string) =>
  slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** The target in words for the admin field, for example "Opens All new videos (/browse/new)" (M41-S08 AC1). */
export function describeViewAll(input: ViewAllInput): string {
  if (input.mode === 'none') return 'No link';
  if (input.mode === 'custom') return input.url ? `Opens ${input.url}` : 'Enter a link';
  const target = resolveViewAll(input);
  if (!target) return 'This section has no View all link';
  const words =
    AUTO_WORDS[input.kind] ??
    (input.kind === 'category' && input.categorySlug
      ? `the ${titleCase(input.categorySlug)} list`
      : input.seriesSlug
        ? 'the series page'
        : 'this list');
  return `Opens ${words} (${target.href})`;
}

/** The address stem of a manual section, from its name. Never empty. */
export function slugifyRowName(name: string): string {
  const stem = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return stem || 'row';
}
