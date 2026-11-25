import './account/account.css';
import type { ReactNode } from 'react';
import { ButtonLink, Link, SiteFooter } from '@ad/ui';
import { getSite } from '../lib/data';
import { getSession } from '../lib/session';
import { setGuestAudienceAction } from '../app/actions';
import { currentGuestAudience } from '../server/guest/guest-view';
import { guestPlayEnabled } from '../server/guest/guest-settings';
import { currentDonateGate, currentTransparencyGate } from '../server/donations/page-data';
import { donateLinkVisible } from '../server/donations/gate';
import { maturityLabelsSetting } from '../server/maturity-labels';
import { MaturityLabelsProvider } from '../lib/maturity-context';
import { getShareSettings } from '../server/seo/page-seo';
import { ShareConfigProvider } from './share/share-context';
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
  // The Donate link exists only when donations are on and the viewer is not a kid (R25).
  const footerLinks = [
    ...site.footerLinks,
    ...(donateLinkVisible(await currentDonateGate()) ? [{ label: msg('donate.link'), href: '/donate' }] : []),
    ...(donateLinkVisible(await currentTransparencyGate()) ? [{ label: msg('donate.howUsed'), href: '/transparency' }] : []),
  ];
  // Share is off on a kids profile and in a guest's Kids mode (D-391).
  const guestKids = session?.profile ? false : (await currentGuestAudience()) === 'kids';
  const shareSettings = session?.profile?.kids || guestKids ? null : await getShareSettings();
  const withLabels = (node: ReactNode) => (
    <MaturityLabelsProvider labels={labels}>
      <ShareConfigProvider value={shareSettings}>{node}</ShareConfigProvider>
    </MaturityLabelsProvider>
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
        footerLinks={footerLinks}
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
        footerLinks={footerLinks}
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
      <SiteFooter platformName={site.platformName} year={year} links={footerLinks} />
    </div>,
  );
}
