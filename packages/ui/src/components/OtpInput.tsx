'use client';

import { useEffect, useId, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { Button } from './Button';
import { cx } from './cx';
import { Icon } from './Icon';

export const DEFAULT_OTP_LABEL = 'Enter the 6 digit code we sent to your email';

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  label = DEFAULT_OTP_LABEL,
  error,
  disabled,
  loading,
  success,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  label?: string;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
  success?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const [focused, setFocused] = useState(false);

  function commit(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length && digits !== value) onComplete?.(digits);
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    commit(event.target.value);
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    commit(event.clipboardData.getData('text'));
  }

  const activeIndex = Math.min(value.length, length - 1);

  return (
    <div className={cx('ad-otp', className)} data-invalid={error ? 'true' : undefined}>
      <label className="ad-sr-only" htmlFor={id}>
        {label}
      </label>
      <div className="ad-otp__field">
        <input
          id={id}
          className="ad-otp__input"
          value={value}
          onChange={onInput}
          onPaste={onPaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={length}
          enterKeyHint="done"
          disabled={disabled || loading}
          autoFocus={autoFocus}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <div className="ad-otp__slots">
          {Array.from({ length }, (_, index) => (
            <span
              key={index}
              className="ad-otp__slot"
              aria-hidden="true"
              data-filled={value[index] ? 'true' : undefined}
              data-active={focused && index === activeIndex ? 'true' : undefined}
            >
              {value[index] ?? ''}
            </span>
          ))}
        </div>
      </div>
      {loading ? (
        <p className="ad-otp__status" role="status">
          <span className="ad-spinner" aria-hidden="true" />
          Checking your code
        </p>
      ) : null}
      {success ? (
        <p className="ad-otp__status" role="status">
          <Icon name="success" size={20} />
          Code accepted
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="ad-field__error" role="alert">
          <Icon name="error" size={16} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

function clock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Resend link locked behind a countdown. Becomes a ghost button when the countdown ends. */
export function ResendCode({
  seconds = 30,
  onResend,
  label = 'Send a new code',
}: {
  seconds?: number;
  onResend: () => void;
  label?: string;
}) {
  const [remaining, setRemaining] = useState(seconds);

  const running = remaining > 0;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setRemaining((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [running]);

  if (remaining > 0) {
    return (
      <p className="ad-otp__countdown">
        {label} in {clock(remaining)}
      </p>
    );
  }
  return (
    <Button
      variant="ghost"
      onClick={() => {
        onResend();
        setRemaining(seconds);
      }}
    >
      {label}
    </Button>
  );
}
