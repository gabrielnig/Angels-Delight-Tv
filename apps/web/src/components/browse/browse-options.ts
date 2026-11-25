import type { Translate } from '@ad/shared/messages';
import type { BrowseLength, BrowseSort } from '../../lib/data';
import type { MenuOption } from './MenuButton';

/** Length choices. Each label is a literal key so the extraction and missing key checks can see it. */
export function lengthOptions(msg: Translate): Array<MenuOption<BrowseLength>> {
  return [
    { value: 'any', label: msg('browse.length.any'), short: msg('browse.length.anyShort') },
    { value: 'short', label: msg('browse.length.short') },
    { value: 'medium', label: msg('browse.length.medium') },
    { value: 'long', label: msg('browse.length.long') },
  ];
}

export function sortOptions(msg: Translate): Array<MenuOption<BrowseSort>> {
  return [
    { value: 'newest', label: msg('browse.sort.newest') },
    { value: 'shortest', label: msg('browse.sort.shortest') },
    { value: 'longest', label: msg('browse.sort.longest') },
    { value: 'az', label: msg('browse.sort.az') },
  ];
}
