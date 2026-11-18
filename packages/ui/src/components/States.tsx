'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Button, ButtonLink } from './Button';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

interface ActionLink {
  label: string;
  href: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon = 'list',
  live,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: ActionLink;
  /** Extra actions below the main one. */
  children?: ReactNode;
  icon?: IconName;
  /** Set when the state appears after a user action such as a filter or a search. */
  live?: boolean;
  className?: string;
}) {
  return (
    <div className={cx('ad-state', className)} role={live ? 'status' : undefined}>
      <Icon name={icon} size={64} className="ad-state__icon" />
      <h2 className="ad-state__title">{title}</h2>
      {description ? <p className="ad-state__text">{description}</p> : null}
      {action ? <ButtonLink href={action.href}>{action.label}</ButtonLink> : null}
      {children}
    </div>
  );
}

export type ErrorVariant = 'inline' | 'banner' | 'page';

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Try again',
  reference,
  variant = 'inline',
  icon = 'warning',
  actions,
  focusOnMount,
  className,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  reference?: string;
  variant?: ErrorVariant;
  icon?: IconName;
  /** Extra actions such as a link home. */
  actions?: ReactNode;
  /** Moves focus to the heading on full page errors. */
  focusOnMount?: boolean;
  className?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount && variant === 'page') heading.current?.focus();
  }, [focusOnMount, variant]);

  const body = (
    <>
      {variant === 'page' ? (
        <h1 ref={heading} tabIndex={-1} className="ad-state__title ad-state__title--page">
          {title}
        </h1>
      ) : variant === 'banner' ? (
        <p className="ad-state__title">{title}</p>
      ) : (
        <p className="ad-state__title ad-state__title--inline">{title}</p>
      )}
      {description ? <p className="ad-state__text">{description}</p> : null}
      {onRetry || actions ? (
        <div className="ad-state__actions">
          {onRetry ? (
            <Button
              variant={variant === 'page' ? 'primary' : 'secondary'}
              icon="retry"
              onClick={onRetry}
            >
              {retryLabel}
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
      {reference ? <p className="ad-state__ref">Reference: {reference}</p> : null}
    </>
  );

  return (
    <div
      className={cx('ad-state', 'ad-state--error', className)}
      data-variant={variant}
      role={variant === 'page' ? undefined : 'alert'}
    >
      <Icon name={icon} size={variant === 'page' ? 64 : 24} className="ad-state__icon" />
      <div className="ad-state__body">{body}</div>
    </div>
  );
}
