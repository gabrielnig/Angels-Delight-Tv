import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost';

interface Common {
  variant?: ButtonVariant;
  icon?: IconName;
  children?: ReactNode;
  className?: string;
}

export interface ButtonProps
  extends Common, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  loading?: boolean;
  /** Why the button is unavailable. Shown as text under the label for screen readers and as a tooltip. */
  disabledReason?: string;
}

const cls = (variant: ButtonVariant, extra?: string) =>
  ['adm-btn', `adm-btn--${variant}`, extra].filter(Boolean).join(' ');

export function Button({
  variant = 'secondary',
  icon,
  loading,
  disabled,
  disabledReason,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const blocked = Boolean(disabled || disabledReason);
  return (
    <button
      {...rest}
      type={type}
      className={cls(variant, className)}
      disabled={blocked && !loading ? true : undefined}
      aria-disabled={blocked || loading ? true : undefined}
      aria-busy={loading || undefined}
      title={disabledReason ?? rest.title}
      onClick={blocked || loading ? (event) => event.preventDefault() : rest.onClick}
    >
      {loading ? (
        <span className="adm-spinner" aria-hidden="true" />
      ) : icon ? (
        <Icon name={icon} size={18} />
      ) : null}
      {children ? <span>{children}</span> : null}
      {disabledReason ? <span className="adm-sr">{`. ${disabledReason}`}</span> : null}
    </button>
  );
}

export function LinkButton({
  href,
  variant = 'secondary',
  icon,
  children,
  className,
  ...rest
}: Common & { href: string; 'aria-label'?: string }) {
  return (
    <Link href={href} className={cls(variant, className)} {...rest}>
      {icon ? <Icon name={icon} size={18} /> : null}
      {children ? <span>{children}</span> : null}
    </Link>
  );
}
