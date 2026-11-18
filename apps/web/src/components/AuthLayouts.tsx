import type { ReactNode } from 'react';
import { Icon, Link } from '@ad/ui';
import type { SiteContent } from '../lib/data';
import { authDisplayClasses } from '../lib/auth-font';
import { AuthIcon } from './auth/AuthParts';
import './auth/auth-ui.css';

export function Brand({ site, inverse = false }: { site: SiteContent; inverse?: boolean }) {
  return (
    <Link
      href="/"
      className="web-brand"
      data-inverse={inverse ? 'true' : undefined}
      aria-label={`${site.platformName}, home`}
    >
      <span className="web-brand__logo" aria-hidden="true">
        <Icon name="play" size={16} filled />
      </span>
      <span className="web-brand__name">{site.platformName}</span>
    </Link>
  );
}

/** Brand mark for the sign in and sign up screens: the mockup's yellow disc with the play glyph. */
export function AuthBrand({ site, inverse = false }: { site: SiteContent; inverse?: boolean }) {
  return (
    <Link
      href="/"
      className="auth-brand"
      data-inverse={inverse ? 'true' : undefined}
      aria-label={`${site.platformName}, home`}
    >
      <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">
        <circle className="auth-brand__glyph-disc" cx="14" cy="14" r="13" />
        <path className="auth-brand__glyph-play" d="M11 8.5v11l9-5.5z" />
      </svg>
      <span>{site.platformName}</span>
    </Link>
  );
}

/** Landing and sign in (S01): brand panel on the left from 960px, the card on the right, a plain header below that. */
export function AuthSplit({ site, children }: { site: SiteContent; children: ReactNode }) {
  return (
    <div className={`auth-root auth-split ${authDisplayClasses}`}>
      <aside className="auth-split__panel">
        <AuthBrand site={site} inverse />
        <div className="auth-pitch">
          <h2 className="auth-pitch__headline">{site.tagline}</h2>
          <ul className="auth-pitch__points">
            {site.valueLines.map((line, index) => (
              <li key={line}>
                <span className="auth-pitch__tick" aria-hidden="true">
                  {index === site.valueLines.length - 1 ? (
                    'CC'
                  ) : (
                    <AuthIcon name={index === 0 ? 'check' : 'clock'} />
                  )}
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label="Footer" className="auth-footer">
          {site.footerLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
          <span className="auth-footer__note">{`${site.platformName} ${new Date().getFullYear()}`}</span>
        </nav>
      </aside>
      <div className="auth-split__main">
        <header className="auth-header">
          <AuthBrand site={site} />
        </header>
        <main id="main" className="auth-body" tabIndex={-1}>
          <div className="auth-card">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Sign up (S02): a bar with the brand and a Have an account link, then the centred card; plain page on mobile. */
export function AuthSignUpPage({ site, children }: { site: SiteContent; children: ReactNode }) {
  return (
    <div className={`auth-root auth-page ${authDisplayClasses}`}>
      <header className="auth-header">
        <AuthBrand site={site} />
        <div className="auth-header__account">
          <span>Have an account?</span>
          <Link href="/sign-in" className="auth-header__button">
            Sign in
          </Link>
        </div>
      </header>
      <main id="main" className="auth-body" tabIndex={-1}>
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}

/** Centred card for sign up, verify, forgot and reset (docs/DESIGN-SYSTEM.md 11.26). */
export function AuthCardPage({
  site,
  children,
  action,
}: {
  site: SiteContent;
  children: ReactNode;
  action?: ReactNode;
}) {
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
