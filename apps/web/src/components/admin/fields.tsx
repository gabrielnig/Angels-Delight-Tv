'use client';

import { useEffect, useId, useRef } from 'react';
import { PasswordInput } from '../PasswordToggle';
import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

interface FieldShell {
  label: string;
  hint?: string;
  error?: string;
  /** Right aligned text beside the label, such as a character counter. */
  aside?: ReactNode;
}

function Shell({
  id,
  label,
  hint,
  error,
  aside,
  children,
}: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className={`adm-field${error ? ' has-error' : ''}`}>
      <div className="adm-field__head">
        <label htmlFor={id} className="adm-field__label">
          {label}
        </label>
        {aside ? <span className="adm-field__aside">{aside}</span> : null}
      </div>
      {children}
      {hint && !error ? (
        <p className="adm-field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="adm-field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const described = (id: string, hint?: string, error?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export function TextField({
  label,
  hint,
  error,
  aside,
  ...rest
}: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const props = {
    id,
    className: 'adm-input',
    'aria-invalid': error ? true : undefined,
    'aria-describedby': described(id, hint, error),
    ...rest,
  } as const;
  return (
    <Shell id={id} label={label} hint={hint} error={error} aside={aside}>
      {rest.type === 'password' ? <PasswordInput {...props} /> : <input {...props} />}
    </Shell>
  );
}

export function TextArea({
  label,
  hint,
  error,
  aside,
  ...rest
}: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error} aside={aside}>
      <textarea
        id={id}
        className="adm-input adm-input--area"
        aria-invalid={error ? true : undefined}
        aria-describedby={described(id, hint, error)}
        {...rest}
      />
    </Shell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  options,
  ...rest
}: FieldShell &
  SelectHTMLAttributes<HTMLSelectElement> & { options: Array<{ value: string; label: string }> }) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        className="adm-input adm-select"
        aria-invalid={error ? true : undefined}
        aria-describedby={described(id, hint, error)}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Shell>
  );
}

export function Checkbox({
  label,
  mixed,
  ...rest
}: { label: string; mixed?: boolean } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(mixed);
  }, [mixed]);
  return (
    <label className="adm-check">
      <input ref={ref} type="checkbox" aria-checked={mixed ? 'mixed' : undefined} {...rest} />
      <span>{label}</span>
    </label>
  );
}

/** Switch with a visible state word so colour never carries the meaning alone. */
export function Switch({
  label,
  checked,
  onChange,
  disabled,
  onLabel = 'On',
  offLabel = 'Off',
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`adm-switch${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="adm-switch__track" aria-hidden="true">
        <span className="adm-switch__thumb" />
      </span>
      <span className="adm-switch__text">{checked ? onLabel : offLabel}</span>
    </button>
  );
}
