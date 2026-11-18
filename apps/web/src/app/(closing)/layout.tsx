import type { ReactNode } from 'react';
import { SiteFooter } from '@ad/ui';
import { Brand } from '../../components/AuthLayouts';
import { getSite } from '../../lib/data';
import '../../components/account/account.css';

/** The pending deletion screen: soft header with the logo only (no links an account in grace cannot use) and the footer. */
export default async function ClosingLayout({ children }: { children: ReactNode }) {
  const site = await getSite().content();
  return (
    <div className="web-authpage acct-site" data-skin="soft">
      <a className="ad-skip" href="#main">
        Skip to main content
      </a>
      <header className="web-authpage__bar">
        <Brand site={site} />
      </header>
      <main id="main" className="web-profiles" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter
        platformName={site.platformName}
        year={new Date().getUTCFullYear()}
        links={site.footerLinks}
        supportEmail={site.supportEmail}
      />
    </div>
  );
}
