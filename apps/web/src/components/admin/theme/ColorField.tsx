'use client';

import { useEffect, useId, useState } from 'react';
import { normalizeHex, type ContrastCheck } from '@ad/theme/client';
import { Button } from '../Button';
import { ContrastBadge } from './ContrastBadge';

const SIX_DIGITS = /^#?[0-9a-f]{6}$/i;

/**
 * Colour picker plus a hex field, so nobody depends on the picker (DESIGN-SYSTEM 11.24).
 * Six digit values apply at once. Three digit values apply on blur. An invalid value shows an
 * inline error on blur and the preview keeps the last valid colour (M18-S01 AC3).
 */
export function ColorField({
  name,
  label,
  hint,
  value,
  onChange,
  onValidity,
  check,
  decorative,
  onReset,
  readOnly,
}: {
  name: string;
  label: string;
  hint: string;
  value: string;
  onChange: (hex: string) => void;
  onValidity: (valid: boolean) => void;
  check?: ContrastCheck;
  decorative?: boolean;
  onReset?: () => void;
  readOnly?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(value);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (normalizeHex(text) !== value) {
      setText(value);
      setError(false);
      onValidity(true);
    }
    // Only react to the committed value changing from outside (reset, restore, suggestion).
  }, [value]);

  function edit(next: string) {
    setText(next);
    if (SIX_DIGITS.test(next.trim())) {
      setError(false);
      onValidity(true);
      onChange(normalizeHex(next)!);
    } else {
      onValidity(next.trim() === '' ? false : normalizeHex(next) !== null);
    }
  }

  function commit() {
    const hex = normalizeHex(text);
    if (hex === null) {
      setError(true);
      onValidity(false);
      return;
    }
    setError(false);
    onValidity(true);
    setText(hex);
    onChange(hex);
  }

  const invalid = error;
  return (
    <div className={`adt-color${invalid ? ' has-error' : ''}`}>
      <div className="adt-color__row">
        <input
          type="color"
          className="adt-color__picker"
          value={value.toLowerCase()}
          aria-label={`Pick ${label}, currently ${value}`}
          disabled={readOnly}
          onChange={(event) => {
            const hex = normalizeHex(event.target.value);
            if (hex) {
              setText(hex);
              setError(false);
              onValidity(true);
              onChange(hex);
            }
          }}
        />
        <div className="adt-color__text">
          <label htmlFor={id} className="adt-color__label">
            {label}
          </label>
          <span className="adt-color__hint">{hint}</span>
        </div>
        <input
          id={id}
          name={name}
          className="adt-color__hex adm-input"
          value={text}
          spellCheck={false}
          autoComplete="off"
          maxLength={9}
          readOnly={readOnly}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(event) => edit(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
        />
        <ContrastBadge check={check} decorative={decorative} invalid={invalid} />
        {onReset ? (
          <Button
            variant="ghost"
            onClick={onReset}
            aria-label={`Reset ${label} to the default`}
            disabled={readOnly}
          >
            Reset
          </Button>
        ) : null}
      </div>
      {invalid ? (
        <p className="adm-field__error" id={`${id}-error`} role="alert">
          Enter a 6 digit hex colour, for example #1F6FB5
        </p>
      ) : null}
    </div>
  );
}
