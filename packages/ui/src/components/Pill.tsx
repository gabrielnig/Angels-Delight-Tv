'use client';

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import { Link } from './Link';

type PillBase = {
  /** Toggle state, rendered with aria-pressed. */
  pressed?: boolean;
  /** Tab state, rendered with aria-selected. */
  selected?: boolean;
  /** Link to the current page, rendered with aria-current. */
  current?: boolean;
  children: ReactNode;
};

export type PillProps = PillBase &
  (
    | ({ href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'>)
    | ({ href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>)
  );

export function Pill(props: PillProps) {
  const { pressed, selected, current, children, className, ...rest } = props;
  const active = Boolean(pressed || selected || current);
  const content = (
    <>
      {active ? <Icon name="check" size={16} /> : null}
      <span>{children}</span>
    </>
  );
  if ('href' in rest && rest.href !== undefined) {
    return (
      <Link
        {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
        className={cx('ad-pill', className)}
        data-active={active ? 'true' : undefined}
        aria-current={current ? 'page' : undefined}
      >
        {content}
      </Link>
    );
  }
  const buttonRest = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  const isTab = buttonRest.role === 'tab';
  return (
    <button
      type="button"
      {...buttonRest}
      className={cx('ad-pill', className)}
      data-active={active ? 'true' : undefined}
      aria-pressed={!isTab && selected === undefined && pressed !== undefined ? pressed : undefined}
      aria-selected={isTab || selected !== undefined ? Boolean(selected) : undefined}
    >
      {content}
    </button>
  );
}

export function PillRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cx('ad-pillrow', className)}>
      {children}
    </div>
  );
}
