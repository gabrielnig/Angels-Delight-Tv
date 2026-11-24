'use client';

import { useEffect, useState } from 'react';
import { msg } from '@ad/shared/messages';
import './google-button.css';
import { GoogleMark } from './GoogleMark';

/**
 * Continue with Google (M49-S05, DESIGN-SYSTEM 11.26). A plain link, because the next step is a full page
 * navigation to the start route. While the browser leaves for Google it locks and says so.
 */
export function GoogleButton({
  href,
  variant = 'continue',
}: {
  href: string;
  variant?: 'continue' | 'signUp';
}) {
  const [redirecting, setRedirecting] = useState(false);

  // Coming back with the Back button restores the page from memory, so the lock must not outlive the trip.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setRedirecting(false);
    };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  const label = redirecting
    ? msg('auth.google.redirecting')
    : variant === 'signUp'
      ? msg('auth.google.signUp')
      : msg('auth.google.continue');

  return (
    <a
      className="google-btn"
      href={href}
      aria-disabled={redirecting ? 'true' : undefined}
      data-redirecting={redirecting ? 'true' : undefined}
      onClick={(event) => {
        if (redirecting) {
          event.preventDefault();
          return;
        }
        setRedirecting(true);
      }}
    >
      {redirecting ? (
        <svg
          className="google-btn__spinner"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" />
          <path
            d="M21 12a9 9 0 00-9-9"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <GoogleMark />
      )}
      <span>{label}</span>
    </a>
  );
}
