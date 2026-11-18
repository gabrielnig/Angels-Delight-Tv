import { msg } from '@ad/shared/messages';

/** Heading and lead line of each account screen (S27 to S30), shared by the page, its loading state and its error state. */
export interface AccountPageCopy {
  title: string;
  lead: string;
  errorTitle: string;
}

export const ACCOUNT_PAGES: Record<string, AccountPageCopy> = {
  '/account': {
    title: msg('account.overview.title'),
    lead: msg('account.overview.lead'),
    errorTitle: msg('account.overview.error'),
  },
  '/account/security': {
    title: msg('account.security.title'),
    lead: msg('account.security.lead'),
    errorTitle: msg('account.security.error'),
  },
  '/settings/playback': {
    title: msg('account.playback.title'),
    lead: msg('account.playback.lead'),
    errorTitle: msg('account.playback.error'),
  },
  '/account/data': {
    title: msg('account.data.title'),
    lead: msg('account.data.lead'),
    errorTitle: msg('account.data.error'),
  },
};

export function accountPageCopy(path: string): AccountPageCopy {
  return ACCOUNT_PAGES[path] ?? ACCOUNT_PAGES['/account']!;
}
