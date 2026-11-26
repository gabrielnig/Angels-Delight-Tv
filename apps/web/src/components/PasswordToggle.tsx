'use client';

import { useState } from 'react';
import type { ComponentProps } from 'react';
import './password-toggle.css';

const EYE = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z';
const EYE_OFF =
  'M3 3l18 18M10 6a9 9 0 012-.1c6 0 10 7 10 7a17 17 0 01-3 3.6M6.6 6.6A17 17 0 002 13s4 7 10 7a9 9 0 003.4-.7';

/**
 * The one show and hide control for every password field (owner feedback, D-397). A plain button: Tab reaches it,
 * Enter and Space press it, aria-pressed says the state, the name says what a press does, and the target is 44 px.
 * It sits inside the field's padding, so showing the password moves nothing.
 */
export function PasswordToggle({
  visible,
  onToggle,
  showLabel = 'Show password',
  hideLabel = 'Hide password',
  className,
}: {
  visible: boolean;
  onToggle: () => void;
  showLabel?: string;
  hideLabel?: string;
  /** Lets a field family keep its own placement class. */
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className ?? 'pw-toggle'}
      aria-label={visible ? hideLabel : showLabel}
      aria-pressed={visible}
      onClick={onToggle}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d={visible ? EYE_OFF : EYE} />
      </svg>
    </button>
  );
}

/** An input of type password with the toggle inside it. For the admin and account field wrappers. */
export function PasswordInput({
  type: _type,
  className,
  ...rest
}: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="pw-control">
      <input
        {...rest}
        type={visible ? 'text' : 'password'}
        className={[className, 'pw-input'].filter(Boolean).join(' ')}
        autoCapitalize="none"
        spellCheck={false}
      />
      <PasswordToggle visible={visible} onToggle={() => setVisible((current) => !current)} />
    </span>
  );
}
