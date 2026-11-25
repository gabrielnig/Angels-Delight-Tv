import { bestScreenMatch } from '@ad/help';

/** Route pattern to article ids, main article first. Built by the shell from the article front matter (`screens`). */
export type HelpScreenMap = Record<string, string[]>;

export const HELP_HOME = '/admin/help';

export const articleHref = (id: string, section?: string): string =>
  `${HELP_HOME}/${id}${section ? `#${section}` : ''}`;

/** Where the Help link on a page goes: the main article for the screen, or the help home when none explains it. */
export function helpTargetFor(
  map: HelpScreenMap,
  pathname: string | null | undefined,
): { ids: string[]; href: string } {
  if (!pathname || pathname === HELP_HOME || pathname.startsWith(`${HELP_HOME}/`)) {
    return { ids: [], href: HELP_HOME };
  }
  const pattern = bestScreenMatch(Object.keys(map), pathname);
  const ids = pattern ? (map[pattern] ?? []) : [];
  return { ids, href: ids[0] ? articleHref(ids[0]) : HELP_HOME };
}
