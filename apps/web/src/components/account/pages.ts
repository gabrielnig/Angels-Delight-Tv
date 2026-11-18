/** Heading and lead line of each account screen (S27 to S30), shared by the page, its loading state and its error state. */
export interface AccountPageCopy {
  title: string;
  lead: string;
  errorTitle: string;
}

export const ACCOUNT_PAGES: Record<string, AccountPageCopy> = {
  '/account': {
    title: 'Account',
    lead: 'Your details, profiles and settings in one place.',
    errorTitle: 'We could not load your account',
  },
  '/account/security': {
    title: 'Account security',
    lead: 'Keep your account safe.',
    errorTitle: 'We could not load your security settings',
  },
  '/settings/playback': {
    title: 'Playback settings',
    lead: 'Choose how video plays on every device. Changes save as you go.',
    errorTitle: 'We could not load your playback settings',
  },
  '/account/data': {
    title: 'Data and privacy',
    lead: 'Download a copy of your data or close your account.',
    errorTitle: 'We could not load your data settings',
  },
};

export function accountPageCopy(path: string): AccountPageCopy {
  return ACCOUNT_PAGES[path] ?? ACCOUNT_PAGES['/account']!;
}
