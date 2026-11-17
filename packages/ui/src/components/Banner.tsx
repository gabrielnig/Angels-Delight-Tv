import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export type BannerTone = 'danger' | 'success' | 'info' | 'warning';

const ICONS: Record<BannerTone, IconName> = {
  danger: 'error',
  success: 'success',
  info: 'info',
  warning: 'warning',
};

/** Page or form level message. Icon plus words, never colour alone. */
export function Banner({
  tone,
  title,
  children,
  action,
  className,
}: {
  tone: BannerTone;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('ad-banner', className)} data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={ICONS[tone]} size={20} />
      <div className="ad-banner__body">
        {title ? <p className="ad-banner__title">{title}</p> : null}
        <p className="ad-banner__text">{children}</p>
      </div>
      {action ? <div className="ad-banner__action">{action}</div> : null}
    </div>
  );
}
