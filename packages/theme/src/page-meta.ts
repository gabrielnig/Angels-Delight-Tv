export const PAGE_SLUGS = ['terms', 'privacy', 'about', 'help'] as const;
export type PageSlug = (typeof PAGE_SLUGS)[number];

export const PAGE_TITLES: Record<PageSlug, string> = {
  terms: 'Terms of use',
  privacy: 'Privacy policy',
  about: 'About',
  help: 'Help',
};
