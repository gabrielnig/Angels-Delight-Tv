import './account/account.css';
import type { ReactNode } from 'react';
import { ButtonLink, Link, SiteFooter } from '@ad/ui';
import { getSite } from '../lib/data';
import { getSession } from '../lib/session';
import { setGuestAudienceAction } from '../app/actions';
import { currentGuestAudience } from '../server/guest/guest-view';
import { guestPlayEnabled } from '../server/guest/guest-settings';
import { maturityLabelsSetting } from '../server/maturity-labels';
import { MaturityLabelsProvider } from '../lib/maturity-context';
import { Brand } from './AuthLayouts';
import { GuestChrome } from './guest/GuestChrome';
import { ViewerChrome } from './ViewerChrome';
import { LanguagePickerHost } from './i18n/LanguagePickerHost';
import { getLocale, getTranslator } from '../lib/i18n/server';
import { pickerData } from '../lib/i18n/picker-data';

/** Signed in with a profile: the full viewer chrome. Otherwise a light public header and footer. */
export async function AppShell({ children, skin }: { children: ReactNode; skin?: 'soft' }) {
  const [site, session] = await Promise.all([getSite().content(), getSession()]);
  const year = new Date().getUTCFullYear();
  const msg = await getTranslator(await getLocale());
  const picker = await pickerData();
  const languagePicker = picker ? <LanguagePickerHost {...picker} /> : undefined;
  const labels = await maturityLabelsSetting();
  const withLabels = (node: ReactNode) => (
    <MaturityLabelsProvider labels={labels}>{node}</MaturityLabelsProvider>
  );
  if (session?.profile) {
    return withLabels(
      <ViewerChrome
        platformName={site.platformName}
        logoUrl={site.logoUrl}
        profileName={session.profile.name}
        profileAvatarId={session.profile.avatarId}
        profileId={session.profile.id}
        kids={session.profile.kids}
        footerLinks={site.footerLinks}
        year={year}
        skin={skin}
        supportEmail={site.supportEmail}
        languagePicker={languagePicker}
      >
        {children}
      </ViewerChrome>,
    );
  }
  if (await guestPlayEnabled()) {
    return withLabels(
      <GuestChrome
        platformName={site.platformName}
        logoUrl={site.logoUrl}
        footerLinks={site.footerLinks}
        year={year}
        signUpOpen={site.signUpOpen}
        kids={(await currentGuestAudience()) === 'kids'}
        setKidsMode={setGuestAudienceAction}
        languagePicker={languagePicker}
      >
        {children}
      </GuestChrome>,
    );
  }
  return withLabels(
    <div className="web-shell">
      <a className="ad-skip" href="#main">
        {msg('nav.skip')}
      </a>
      <header className="web-publicbar">
        <Brand site={site} />
        <nav aria-label={msg('nav.account')} className="web-publicbar__links">
          <Link href="/sign-in" className="web-publicbar__link">
            {msg('nav.signIn')}
          </Link>
          {site.signUpOpen ? (
            <ButtonLink href="/sign-up" size="sm">
              {msg('nav.createAccount')}
            </ButtonLink>
          ) : null}
        </nav>
      </header>
      <main id="main" className="web-main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter platformName={site.platformName} year={year} links={site.footerLinks} />
    </div>,
  );
}
