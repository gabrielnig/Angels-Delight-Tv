/** The eight learning paths in learning order (plan L14 section 3). The letter is the first character of every article id. */
export const HELP_PATHS = [
  {
    key: 'start',
    letter: 'S',
    title: 'Start here',
    lead: 'Sign in, find your way and publish your first video.',
  },
  { key: 'daily', letter: 'D', title: 'Daily tasks', lead: 'What an Editor does every day.' },
  {
    key: 'weekly',
    letter: 'W',
    title: 'Weekly tasks',
    lead: 'Series, Home rows, captions in depth and the numbers.',
  },
  {
    key: 'setup',
    letter: 'C',
    title: 'Setup and settings',
    lead: 'Brand, switches, pages, languages, team and system.',
  },
  { key: 'money', letter: 'M', title: 'Money and sponsors', lead: 'Sponsors and donations.' },
  {
    key: 'safety',
    letter: 'K',
    title: 'Safety and kids',
    lead: 'Kids mode, ratings, guests, accounts and privacy.',
  },
  {
    key: 'troubleshooting',
    letter: 'T',
    title: 'Troubleshooting',
    lead: 'Start from what you see and find the fix.',
  },
  {
    key: 'reference',
    letter: 'R',
    title: 'Reference',
    lead: 'Glossary, roles, screens, settings and checklists.',
  },
] as const;

export type HelpPathKey = (typeof HELP_PATHS)[number]['key'];
export const HELP_PATH_KEYS = HELP_PATHS.map((p) => p.key) as [HelpPathKey, ...HelpPathKey[]];

/** Staff roles as the help centre words them. The values match the code, the labels are for people. */
export const HELP_ROLES = ['editor', 'admin', 'super_admin'] as const;
export type HelpRole = (typeof HELP_ROLES)[number];
export const HELP_ROLE_LABELS: Record<HelpRole, string> = {
  editor: 'Editor',
  admin: 'Admin',
  super_admin: 'Super admin',
};
export const HELP_ROLE_RANK: Record<HelpRole, number> = { editor: 1, admin: 2, super_admin: 3 };

/** A guide id is one path letter and two digits, for example D02. Ids are never reused or renumbered. */
export const ARTICLE_ID = /^[SDWCMKTR]\d{2}$/;
/** A video id is V plus the article id, for example VD02. */
export const VIDEO_ID = /^V[SDWCMKTR]\d{2}$/;

export function pathForLetter(letter: string) {
  return HELP_PATHS.find((p) => p.letter === letter);
}
export function pathByKey(key: string) {
  return HELP_PATHS.find((p) => p.key === key);
}

/** True when the person's role can do what the guide is for. */
export function roleCanDo(person: HelpRole, needed: HelpRole): boolean {
  return HELP_ROLE_RANK[person] >= HELP_ROLE_RANK[needed];
}
