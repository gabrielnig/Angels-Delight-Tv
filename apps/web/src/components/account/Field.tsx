'use client';

import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { AcctIcon } from './icons';

/** Label above a 44px input, with the mockup error line (warning icon and red text) underneath. */
export function AcctField({
  label,
  error,
  ok,
  invalid,
  inputRef,
  ...rest
}: {
  label: string;
  error?: string;
  /** Shows a green tick inside the field, for a confirm field that matches. */
  ok?: boolean;
  /** Marks the field invalid without a message, when the rule list beside it already says why. */
  invalid?: boolean;
  inputRef?: (el: HTMLInputElement | null) => void;
} & InputHTMLAttributes<HTMLInputElement>): ReactNode {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label className="acct-field__label" htmlFor={id}>
        {label}
      </label>
      <div className={ok ? 'acct-field__ok' : undefined}>
        <input
          {...rest}
          id={id}
          ref={inputRef}
          className="acct-input"
          aria-invalid={error || invalid ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {ok ? <AcctIcon name="check" size={18} /> : null}
      </div>
      {error ? (
        <p id={errorId} className="acct-field__error">
          <AcctIcon name="warning" size={16} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
