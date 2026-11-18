import type { BrowseLength, BrowseSort } from '../../lib/data';

export const LENGTHS: Array<{ value: BrowseLength; label: string }> = [
  { value: 'any', label: 'Any length' },
  { value: 'short', label: 'Under 5 min' },
  { value: 'medium', label: '5 to 15 min' },
  { value: 'long', label: 'Over 15 min' },
];
export const SORTS: Array<{ value: BrowseSort; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'shortest', label: 'Shortest' },
  { value: 'longest', label: 'Longest' },
  { value: 'az', label: 'A to Z' },
];

export function parseLength(v: string | undefined): BrowseLength {
  return LENGTHS.some((l) => l.value === v) ? (v as BrowseLength) : 'any';
}
export function parseSort(v: string | undefined): BrowseSort {
  return SORTS.some((s) => s.value === v) ? (v as BrowseSort) : 'newest';
}

export function browseHref(base: string, length: BrowseLength, sort: BrowseSort) {
  const params = new URLSearchParams();
  if (length !== 'any') params.set('length', length);
  if (sort !== 'newest') params.set('sort', sort);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** The non default choices as removable chips. Each remove link keeps the other choice. */
export function activeChips(base: string, length: BrowseLength, sort: BrowseSort) {
  const chips: Array<{ label: string; removeHref: string }> = [];
  if (length !== 'any') {
    chips.push({
      label: LENGTHS.find((l) => l.value === length)!.label,
      removeHref: browseHref(base, 'any', sort),
    });
  }
  if (sort !== 'newest') {
    chips.push({
      label: SORTS.find((s) => s.value === sort)!.label,
      removeHref: browseHref(base, length, 'newest'),
    });
  }
  return chips;
}
