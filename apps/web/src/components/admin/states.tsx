import type { ReactNode } from 'react';
import { Button, LinkButton } from './Button';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export function EmptyState({
  title,
  help,
  icon = 'film',
  action,
  live,
}: {
  title: string;
  help?: string;
  icon?: IconName;
  action?: ReactNode;
  /** True only when the empty state appears after a filter or search. */
  live?: boolean;
}) {
  return (
    <div className="adm-empty" role={live ? 'status' : undefined}>
      <Icon name={icon} size={48} />
      <h2 className="adm-empty__title">{title}</h2>
      {help ? <p className="adm-empty__help">{help}</p> : null}
      {action ? <div className="adm-empty__action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong on our side.',
  help = 'Your videos are safe. Try again in a moment.',
  onRetry,
  retryLabel = 'Try again',
  reference,
  compact,
}: {
  title?: string;
  help?: string;
  onRetry?: () => void;
  retryLabel?: string;
  reference?: string;
  compact?: boolean;
}) {
  return (
    <div className={`adm-error${compact ? ' adm-error--compact' : ''}`} role="alert">
      <Icon name="alert" size={compact ? 20 : 48} />
      <div>
        <p className="adm-error__title">{title}</p>
        <p className="adm-error__help">{help}</p>
        {reference ? <p className="adm-error__ref">Reference: {reference}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="secondary" icon="retry" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function Banner({
  tone = 'info',
  children,
  action,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  children: ReactNode;
  action?: ReactNode;
}) {
  const icon: IconName =
    tone === 'danger' || tone === 'warning' ? 'alert' : tone === 'success' ? 'check' : 'info';
  return (
    <div className={`adm-banner adm-banner--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={icon} size={20} />
      <div className="adm-banner__body">{children}</div>
      {action}
    </div>
  );
}

/** Skeleton with matched geometry. Appears after 300ms via CSS, static under reduced motion. */
export function Skeleton({
  rows = 3,
  height = '3.5rem',
  label = 'Loading',
}: {
  rows?: number;
  height?: string;
  label?: string;
}) {
  return (
    <div className="adm-skeleton" aria-busy="true" aria-label={label} role="status">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="adm-skeleton__row" style={{ height }} />
      ))}
    </div>
  );
}

export function NoAccess({
  pageName,
  roleLabel,
  needed,
}: {
  /** Leave out pageName and needed for the generic answer the 403 page gives. */
  pageName?: string;
  roleLabel: string;
  needed?: string;
}) {
  return (
    <div className="adm-error" role="alert">
      <Icon name="lock" size={48} />
      <div>
        <h1 className="adm-error__title adm-h2" tabIndex={-1} id="no-access-heading">
          You do not have access to this page
        </h1>
        <p className="adm-error__help">
          {pageName && needed ? `${pageName} is only for ${needed}. ` : 'This page is for admins. '}
          Your role is {roleLabel}. Ask an admin if you need it.
        </p>
        <p className="adm-error__ref">Error 403</p>
      </div>
      <LinkButton href="/admin" variant="primary">
        Back to dashboard
      </LinkButton>
    </div>
  );
}
