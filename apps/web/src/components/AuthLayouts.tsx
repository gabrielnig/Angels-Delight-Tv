import type { ReactNode } from 'react';
import { Icon, Link } from '@ad/ui';
import type { SiteContent } from '../lib/data';

export function Brand({ site, inverse = false }: { site: SiteContent; inverse?: boolean }) {
  return (
    <Link href="/" className="web-brand" data-inverse={inverse ? 'true' : undefined} aria-label={`${site.platformName}, home`}>
      <span className="web-brand__logo" aria-hidden="true">
        <Icon name="play" size={16} filled />
      </span>
      <span className="web-brand__name">{site.platformName}</span>
    </Link>
  );
}

/** Screen 1 and 7: brand panel on the left from md, sign in card on the right. */
export function AuthSplit({ site, children }: { site: SiteContent; children: ReactNode }) {
  return (
    <div className="web-split">
      <aside className="web-split__panel">
        <Brand site={site} inverse />
        <div className="web-split__pitch">
          <p className="web-split__tagline">{site.tagline}</p>
          <ul className="web-split__points">
            {site.valueLines.map((line, index) => (
              <li key={line}>
                <span className="web-split__tick" aria-hidden="true">
                  {index === site.valueLines.length - 1 ? 'CC' : <Icon name={index === 0 ? 'check' : 'clock'} size={20} />}
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label="Footer" className="web-split__footer">
          {site.footerLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main id="main" className="web-split__main" tabIndex={-1}>
        <div className="web-authcard">
          <div className="web-split__mobilebrand">
            <Brand site={site} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

/** Centred card for sign up, verify, forgot and reset (docs/DESIGN-SYSTEM.md 11.26). */
export function AuthCardPage({ site, children, action }: { site: SiteContent; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="web-authpage">
      <header className="web-authpage__bar">
        <Brand site={site} />
        {action}
      </header>
      <main id="main" className="web-authpage__main" tabIndex={-1}>
        <div className="web-authcard">{children}</div>
      </main>
    </div>
  );
}
