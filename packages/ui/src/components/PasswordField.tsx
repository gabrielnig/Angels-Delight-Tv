'use client';

import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react';
import { IconButton } from './Button';
import { cx } from './cx';
import { FieldFrame } from './Field';
import { Icon } from './Icon';
import {
  evaluatePassword,
  MIN_PASSWORD_LENGTH,
  zxcvbnScorer,
  type PasswordScorer,
} from './password';

export interface PasswordFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  /** current on sign in, new on sign up and reset. */
  mode?: 'current' | 'new';
  showStrength?: boolean;
  scorer?: PasswordScorer;
  error?: string;
  hint?: string;
}

export function PasswordField({
  label,
  value,
  onChange,
  mode = 'current',
  showStrength = false,
  scorer = zxcvbnScorer,
  error,
  hint,
  id,
  className,
  onKeyUp,
  onKeyDown,
  ...rest
}: PasswordFieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const meterId = `${inputId}-meter`;
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!showStrength || value.length === 0) {
      setScore(0);
      return;
    }
    let cancelled = false;
    scorer(value)
      .then((next) => {
        if (!cancelled) setScore(next);
      })
      .catch(() => {
        if (!cancelled) setScore(value.length >= MIN_PASSWORD_LENGTH ? 2 : 0);
      });
    return () => {
      cancelled = true;
    };
  }, [value, showStrength, scorer]);

  const result = evaluatePassword(value, score);
  const describedBy = [hint ? hintId : null, error ? errorId : null, showStrength ? meterId : null]
    .filter(Boolean)
    .join(' ');

  function trackCaps(event: KeyboardEvent<HTMLInputElement>) {
    if (typeof event.getModifierState === 'function') setCaps(event.getModifierState('CapsLock'));
  }

  return (
    <FieldFrame
      inputId={inputId}
      hintId={hintId}
      errorId={errorId}
      label={label}
      hint={hint}
      error={error}
      className={className}
    >
      <div className="ad-field__control">
        <input
          {...rest}
          id={inputId}
          type={visible ? 'text' : 'password'}
          className="ad-input ad-input--with-action"
          value={value}
          onChange={onChange}
          onKeyUp={(event) => {
            trackCaps(event);
            onKeyUp?.(event);
          }}
          onKeyDown={(event) => {
            trackCaps(event);
            onKeyDown?.(event);
          }}
          autoComplete={mode === 'new' ? 'new-password' : 'current-password'}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy || undefined}
        />
        <IconButton
          className="ad-field__action"
          label={visible ? 'Hide password' : 'Show password'}
          icon={visible ? 'eyeOff' : 'eye'}
          pressed={visible}
          onClick={() => setVisible((current) => !current)}
        />
      </div>
      {caps ? (
        <p className="ad-field__hint" role="status">
          Caps Lock is on
        </p>
      ) : null}
      {showStrength ? (
        <div id={meterId} className="ad-strength" data-tone={result.tone}>
          <div className="ad-strength__bar" aria-hidden="true">
            {[1, 2, 3, 4].map((segment) => (
              <span key={segment} data-on={segment <= result.segments ? 'true' : undefined} />
            ))}
          </div>
          <p className="ad-strength__word">
            <span className="ad-sr-only">Password strength: </span>
            {result.label}
          </p>
          <ul className="ad-checklist">
            <Rule met={result.lengthOk}>{`At least ${MIN_PASSWORD_LENGTH} characters`}</Rule>
            <Rule met={result.notCommon && value.length > 0}>Not a common password</Rule>
            <li className={cx('ad-checklist__item')} data-hint="true">
              <Icon name="info" size={16} />
              <span>Better with a mix of words you can remember</span>
            </li>
          </ul>
        </div>
      ) : null}
    </FieldFrame>
  );
}

function Rule({ met, children }: { met: boolean; children: string }) {
  return (
    <li className="ad-checklist__item" data-met={met ? 'true' : 'false'}>
      <Icon name={met ? 'success' : 'clock'} size={16} />
      <span className="ad-sr-only">{met ? 'Done: ' : 'Not yet: '}</span>
      <span>{children}</span>
    </li>
  );
}
