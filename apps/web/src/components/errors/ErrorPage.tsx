'use client';

import { useT } from '../../lib/i18n/provider';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button, ButtonLink } from '@ad/ui';
import './errors.css';

export type ErrorAction = { label: string; href: string } | { label: string; onClick: () => void };

export interface ErrorPageProps {
  /** Big status number such as 404. */
  code?: string;
  title: string;
  description: string;
  /** Plain text the viewer can quote. Never a link. */
  reference?: string;
  supportEmail?: string;
  /** A search field that submits to /search. It is a field, not an action. */
  search?: boolean;
  /** The one action (R39). */
  action: ErrorAction;
  /** Suggestions go here, outside the message block. */
  children?: ReactNode;
}

/**
 * Every error state shows exactly one action (R39, M45-S14). The heading takes focus on mount so a screen reader
 * announces what happened, and the page is never indexed. The support email and the reference are plain text.
 */
export function ErrorPage({
  code,
  title,
  description,
  reference,
  supportEmail,
  search,
  action,
  children,
}: ErrorPageProps) {
  const msg = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div className="web-page ad-errorpage">
      <meta name="robots" content="noindex,nofollow" />
      <div className="ad-error">
        {code ? (
          <p className="ad-error__code" aria-hidden="true">
            {code}
          </p>
        ) : null}
        <h1 ref={heading} className="ad-error__title" tabIndex={-1}>
          {title}
        </h1>
        <p className="ad-error__text">{description}</p>
        {search ? (
          <form className="ad-error__search" action="/search" method="get" role="search">
            <input
              className="ad-input"
              type="search"
              name="q"
              maxLength={100}
              placeholder={msg('errors.searchForALesson')}
              aria-label={msg('errors.searchForALesson')}
              autoComplete="off"
            />
          </form>
        ) : null}
        {supportEmail ? (
          <p className="ad-error__small">
            {msg('errors.ifItKeepsHappening')}{' '}
            <span className="ad-error__mono">{supportEmail}</span>
            {reference ? ' and quote the reference below.' : '.'}
          </p>
        ) : null}
        {reference ? (
          <p className="ad-error__small">
            {msg('errors.reference')} <span className="ad-error__mono">{reference}</span>
          </p>
        ) : null}
        <div className="ad-error__actions">
          {'href' in action ? (
            <ButtonLink href={action.href}>{action.label}</ButtonLink>
          ) : (
            <Button onClick={action.onClick}>{action.label}</Button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
