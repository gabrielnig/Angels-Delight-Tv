import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export type BadgeVariant =
  'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent' | 'kids' | 'duration';

const ICONS: Partial<Record<BadgeVariant, IconName>> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'error',
  kids: 'shield',
};

export function Badge({
  variant = 'neutral',
  srText,
  children,
  className,
}: {
  variant?: BadgeVariant;
  /** Full reading for assistive technology, for example "4 minutes 12 seconds" for a duration badge. */
  srText?: string;
  children: ReactNode;
  className?: string;
}) {
  const icon = ICONS[variant];
  return (
    <span className={cx('ad-badge', className)} data-variant={variant}>
      {icon ? <Icon name={icon} size={16} /> : null}
      <span aria-hidden={srText ? 'true' : undefined}>{children}</span>
      {srText ? <span className="ad-sr-only">{srText}</span> : null}
    </span>
  );
}
