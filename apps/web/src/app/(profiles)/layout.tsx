import type { ReactNode } from 'react';
import { Brand } from '../../components/AuthLayouts';
import { SignOutButton } from '../../components/SignOutButton';
import { getSite } from '../../lib/data';

/** Profile screens show the logo only, no navigation (docs/DESIGN-SYSTEM.md section 12). */
export default async function ProfilesLayout({ children }: { children: ReactNode }) {
  const site = await getSite().content();
  return (
    <div className="web-authpage">
      <a className="ad-skip" href="#main">
        Skip to main content
      </a>
      <header className="web-authpage__bar">
        <Brand site={site} />
        <SignOutButton />
      </header>
      <main id="main" className="web-profiles" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
