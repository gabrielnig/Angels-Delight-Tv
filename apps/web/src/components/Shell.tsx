import type { ReactNode } from 'react';
import { ButtonLink, Link, SiteFooter } from '@ad/ui';
import { getSite } from '../lib/data';
import { getSession } from '../lib/session';
import { Brand } from './AuthLayouts';
import { ViewerChrome } from './ViewerChrome';

/** Signed in with a profile: the full viewer chrome. Otherwise a light public header and footer. */
export async function AppShell({ children }: { children: ReactNode }) {
  const [site, session] = await Promise.all([getSite().content(), getSession()]);
  const year = new Date().getUTCFullYear();
  if (session?.profile) {
    return (
      <ViewerChrome
        platformName={site.platformName}
        logoUrl={site.logoUrl}
        profileName={session.profile.name}
        profileId={session.profile.id}
        kids={session.profile.kids}
        footerLinks={site.footerLinks}
        year={year}
      >
        {children}
      </ViewerChrome>
    );
  }
  return (
    <div className="web-shell">
      <a className="ad-skip" href="#main">
        Skip to main content
      </a>
      <header className="web-publicbar">
        <Brand site={site} />
        <nav aria-label="Account" className="web-publicbar__links">
          <Link href="/sign-in" className="web-publicbar__link">
            Sign in
          </Link>
          {site.signUpOpen ? (
            <ButtonLink href="/sign-up" size="sm">
              Create account
            </ButtonLink>
          ) : null}
        </nav>
      </header>
      <main id="main" className="web-main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter platformName={site.platformName} year={year} links={site.footerLinks} />
    </div>
  );
}
