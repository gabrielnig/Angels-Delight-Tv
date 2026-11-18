'use client';

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import { Link } from './Link';

export type ButtonVariant =
  'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'danger-outline' | 'on-dark';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface Common {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: IconName;
  children?: ReactNode;
}

export function Spinner() {
  return <span className="ad-spinner" aria-hidden="true" />;
}

export interface ButtonProps extends Common, ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  icon,
  loading,
  children,
  className,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cx('ad-btn', className)}
      data-variant={variant}
      data-size={size}
      data-full={fullWidth ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
      aria-disabled={loading ? 'true' : rest['aria-disabled']}
      onClick={loading ? (event) => event.preventDefault() : onClick}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} size={20} /> : null}
      <span>{children}</span>
    </button>
  );
}

export interface ButtonLinkProps extends Common, AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  fullWidth,
  icon,
  children,
  className,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      {...rest}
      className={cx('ad-btn', className)}
      data-variant={variant}
      data-size={size}
      data-full={fullWidth ? 'true' : undefined}
    >
      {icon ? <Icon name={icon} size={20} /> : null}
      <span>{children}</span>
    </Link>
  );
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  icon: IconName;
  pressed?: boolean;
  variant?: 'plain' | 'surface' | 'on-dark';
  iconSize?: number;
}

export function IconButton({
  label,
  icon,
  pressed,
  variant = 'plain',
  iconSize = 24,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={cx('ad-iconbtn', className)}
      data-variant={variant}
      aria-label={label}
      aria-pressed={pressed === undefined ? undefined : pressed}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
}
