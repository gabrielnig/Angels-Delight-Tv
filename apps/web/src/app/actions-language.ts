'use server';

import { cookies } from 'next/headers';
import { getProfiles } from '../lib/data';
import { themeRuntime } from '../lib/data/admin/theme-runtime';
import { LOCALE_COOKIE, localeCookieOptions } from '../lib/i18n/cookie';
import { setLanguage, type SetLanguageResult } from '../lib/i18n/set-language';
import { getSession } from '../lib/session';

/** The picker's server action (M46): cookie for everyone, profile too when signed in, never for a kids profile. */
export async function setLanguageAction(code: string): Promise<SetLanguageResult> {
  return setLanguage(String(code), {
    enabled: async () => (await themeRuntime()).settings.get('content.ui_languages'),
    session: async () => {
      const s = await getSession();
      return s?.profile ? { accountId: s.accountId, profileId: s.profile.id, kids: s.profile.kids } : null;
    },
    setCookie: async (locale) => {
      (await cookies()).set(LOCALE_COOKIE, locale, localeCookieOptions(process.env.NODE_ENV === 'production'));
    },
    saveProfile: async (accountId, profileId, locale) => {
      await getProfiles().update(accountId, profileId, { language: locale });
    },
  });
}
