'use client';

import { msg as sharedMsg, type Translate } from '@ad/shared/messages';
import { useT } from '../../lib/i18n/provider';
import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { evaluatePassword, MIN_PASSWORD_LENGTH, zxcvbnScorer, type PasswordScorer } from '@ad/ui';

/** Presentation parts for the sign in and sign up screens, drawn to the S01 and S02 mockups. */

export type AuthIconName = 'alert' | 'clock' | 'check' | 'info' | 'eye' | 'eyeOff' | 'ring';

const PATHS: Record<AuthIconName, ReactNode> = {
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.5v.01" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <path d="M3 3l18 18M10.6 6.2A9.6 9.6 0 0112 6c6.5 0 10 6 10 6a17 17 0 01-3.2 3.9M6.3 7.6C3.6 9.4 2 12 2 12s3.5 6 10 6c1.5 0 2.8-.3 4-.8" />
  ),
  ring: <circle cx="12" cy="12" r="8" />,
};

export function AuthIcon({
  name,
  size = 20,
  stroke = 'currentColor',
  strokeWidth = 2,
}: {
  name: AuthIconName;
  size?: number;
  stroke?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

export type AuthTone = 'danger' | 'warning' | 'success' | 'info';

const TONE_ICON: Record<AuthTone, AuthIconName> = {
  danger: 'alert',
  warning: 'alert',
  success: 'check',
  info: 'info',
};

/** Form level message: icon plus words, never colour alone. */
export function AuthBanner({
  tone,
  icon,
  title,
  children,
}: {
  tone: AuthTone;
  icon?: AuthIconName;
  title?: string;
  children: ReactNode;
}) {
  const name = icon ?? TONE_ICON[tone];
  return (
    <div
      className="auth-banner"
      data-tone={tone}
      data-icon={name === TONE_ICON[tone] ? undefined : name}
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
    >
      <AuthIcon name={name} />
      <div>
        {title ? <div className="auth-banner__title">{title}</div> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
  /** Marks the field invalid (red edge) without an inline message, for the generic wrong password state. */
  invalid?: boolean;
  /** Extra content inside the control, after the input (the show password button). */
  action?: ReactNode;
  id?: string;
}

export function AuthField({
  label,
  error,
  hint,
  invalid,
  action,
  id,
  className,
  'aria-describedby': describedByProp,
  ...rest
}: AuthFieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const isInvalid = Boolean(error) || Boolean(invalid);
  const describedBy =
    [describedByProp, hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;
  return (
    <div className="auth-field" data-invalid={isInvalid ? 'true' : undefined}>
      <label className="auth-field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="auth-field__control">
        <input
          {...rest}
          id={inputId}
          className={['auth-input', action ? 'auth-input--with-action' : '', className ?? '']
            .filter(Boolean)
            .join(' ')}
          aria-invalid={isInvalid ? 'true' : undefined}
          aria-required={rest.required ? 'true' : undefined}
          aria-describedby={describedBy}
        />
        {action}
      </div>
      {error ? (
        <p className="auth-field__error" id={errorId} role="alert">
          <AuthIcon name="alert" size={18} />
          <span>{error}</span>
        </p>
      ) : null}
      {hint ? (
        <p className="auth-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface MeterView {
  word: string;
  segments: number;
  tone: 'muted' | 'warning' | 'info' | 'success';
  label: string;
}

/** Maps the shared password rules onto the mockup meter: Strength, Weak (2), Okay (3), Strong (4). */
export function meterView(password: string, score: number, msg: Translate = sharedMsg): MeterView {
  if (password.length === 0) {
    return {
      word: msg('auth.strengthWord'),
      segments: 0,
      tone: 'muted',
      label: msg('auth.strengthNotStarted'),
    };
  }
  const result = evaluatePassword(password, score);
  if (result.label === 'Okay')
    return {
      word: msg('auth.strengthOkay'),
      segments: 3,
      tone: 'info',
      label: msg('auth.strengthOkay'),
    };
  if (result.label === 'Strong')
    return {
      word: msg('auth.strengthStrong'),
      segments: 4,
      tone: 'success',
      label: msg('auth.strengthStrong'),
    };
  const segments =
    result.label === 'Too short'
      ? Math.min(2, Math.ceil(password.length / 5))
      : Math.max(1, Math.min(2, result.segments));
  return {
    word: msg('auth.strengthWeak'),
    segments,
    tone: 'warning',
    label: msg('auth.strengthWeak'),
  };
}

function Rule({ met, children, hint }: { met?: boolean; children: string; hint?: boolean }) {
  return (
    <li data-met={met ? 'true' : undefined}>
      {met ? (
        <AuthIcon name="check" size={18} stroke="var(--color-success)" strokeWidth={2.5} />
      ) : (
        <AuthIcon name="ring" size={18} stroke="var(--color-muted)" />
      )}
      <span>
        {children}
        <span className="auth-sr">{met ? ' (met)' : hint ? ' (hint)' : ' (not met)'}</span>
      </span>
    </li>
  );
}

interface AuthPasswordFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'id'
> {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  mode?: 'current' | 'new';
  showStrength?: boolean;
  scorer?: PasswordScorer;
  error?: string;
  invalid?: boolean;
}

export function AuthPasswordField({
  label,
  value,
  onChange,
  mode = 'current',
  showStrength = false,
  scorer = zxcvbnScorer,
  error,
  invalid,
  onKeyUp,
  onKeyDown,
  ...rest
}: AuthPasswordFieldProps) {
  const msg = useT();
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

  function trackCaps(event: KeyboardEvent<HTMLInputElement>) {
    if (typeof event.getModifierState === 'function') setCaps(event.getModifierState('CapsLock'));
  }

  const result = evaluatePassword(value, score);
  const view = meterView(value, score, msg);
  const field = (
    <AuthField
      {...rest}
      label={label}
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      error={error}
      invalid={invalid}
      autoComplete={mode === 'new' ? 'new-password' : 'current-password'}
      autoCapitalize="none"
      spellCheck={false}
      onKeyUp={(event) => {
        trackCaps(event);
        onKeyUp?.(event);
      }}
      onKeyDown={(event) => {
        trackCaps(event);
        onKeyDown?.(event);
      }}
      action={
        <button
          type="button"
          className="auth-field__action"
          aria-label={visible ? msg('auth.hidePassword') : msg('auth.showPassword')}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <AuthIcon name={visible ? 'eyeOff' : 'eye'} />
        </button>
      }
    />
  );

  return (
    <>
      {showStrength ? (
        <div className="auth-pw">
          {field}
          <div
            className="auth-meter"
            role="group"
            aria-label={msg('auth.passwordStrength', { label: view.label })}
            data-tone={view.tone}
          >
            <div className="auth-meter__bar" aria-hidden="true">
              {[1, 2, 3, 4].map((segment) => (
                <span key={segment} data-on={segment <= view.segments ? 'true' : undefined} />
              ))}
            </div>
            <span className="auth-meter__word">{view.word}</span>
          </div>
          <ul className="auth-checklist">
            <Rule met={result.lengthOk}>
              {msg('auth.atLeastCharacters', { count: MIN_PASSWORD_LENGTH })}
            </Rule>
            <Rule met={result.notCommon && value.length > 0}>{msg('auth.notACommonPassword')}</Rule>
            <Rule hint met={view.label === 'Strong'}>
              {msg('auth.betterWithAMix')}
            </Rule>
          </ul>
        </div>
      ) : (
        field
      )}
      {caps ? (
        <div className="auth-caps" role="status">
          <AuthIcon name="alert" size={18} />
          <span>{msg('auth.capsLockIsOn')}</span>
        </div>
      ) : null}
    </>
  );
}

const SPINNER = (
  <svg
    className="auth-spinner"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" />
    <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/** Full width primary button. Loading keeps the label, adds the inline spinner and blocks repeat taps. */
export function AuthSubmit({
  loading,
  disabled,
  children,
}: {
  loading?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className="ad-btn auth-submit"
      data-variant="primary"
      data-size="lg"
      data-full="true"
      aria-busy={loading ? 'true' : undefined}
      aria-disabled={loading ? 'true' : undefined}
      disabled={disabled}
      onClick={loading ? (event) => event.preventDefault() : undefined}
    >
      {loading ? SPINNER : null}
      <span>{children}</span>
    </button>
  );
}
