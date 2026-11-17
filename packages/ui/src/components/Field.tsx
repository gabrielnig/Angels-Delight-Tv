'use client';

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

interface FieldMeta {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  optional?: boolean;
  loading?: boolean;
}

function useFieldIds(id: string | undefined, hasHint: boolean, hasError: boolean) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hasHint ? hintId : null, hasError ? errorId : null]
    .filter(Boolean)
    .join(' ');
  return { inputId, hintId, errorId, describedBy: describedBy || undefined };
}

export function FieldFrame({
  inputId,
  label,
  hint,
  hintId,
  error,
  errorId,
  required,
  optional,
  children,
  className,
}: {
  inputId: string;
  hintId: string;
  errorId: string;
  className?: string;
  children: ReactNode;
} & Pick<FieldMeta, 'label' | 'hint' | 'error' | 'required' | 'optional'>) {
  return (
    <div className={cx('ad-field', className)} data-invalid={error ? 'true' : undefined}>
      <label className="ad-field__label" htmlFor={inputId}>
        {label}
        {required ? <span className="ad-field__flag"> (required)</span> : null}
        {optional ? <span className="ad-field__flag"> (optional)</span> : null}
      </label>
      {children}
      {hint ? (
        <p className="ad-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="ad-field__error" id={errorId}>
          <Icon name="error" size={16} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps
  extends FieldMeta, Omit<InputHTMLAttributes<HTMLInputElement>, 'required' | 'size'> {}

export function Input({
  label,
  hint,
  error,
  required,
  optional,
  loading,
  id,
  className,
  ...rest
}: InputProps) {
  const ids = useFieldIds(id, Boolean(hint), Boolean(error));
  return (
    <FieldFrame
      {...ids}
      label={label}
      hint={hint}
      error={error}
      required={required}
      optional={optional}
      className={className}
    >
      <div className="ad-field__control">
        <input
          {...rest}
          id={ids.inputId}
          className="ad-input"
          required={required}
          aria-required={required ? 'true' : undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={ids.describedBy}
          aria-busy={loading ? 'true' : undefined}
        />
        {loading ? <span className="ad-spinner ad-field__spinner" aria-hidden="true" /> : null}
      </div>
    </FieldFrame>
  );
}

export interface TextareaProps
  extends FieldMeta, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'required'> {}

export function Textarea({
  label,
  hint,
  error,
  required,
  optional,
  id,
  className,
  ...rest
}: TextareaProps) {
  const ids = useFieldIds(id, Boolean(hint), Boolean(error));
  return (
    <FieldFrame
      {...ids}
      label={label}
      hint={hint}
      error={error}
      required={required}
      optional={optional}
      className={className}
    >
      <textarea
        {...rest}
        id={ids.inputId}
        className="ad-input ad-input--area"
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={ids.describedBy}
      />
    </FieldFrame>
  );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  hint?: ReactNode;
}

export function Checkbox({ label, hint, className, id, ...rest }: CheckboxProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className={cx('ad-check', className)}>
      <label className="ad-check__label" htmlFor={inputId}>
        <input {...rest} id={inputId} type="checkbox" className="ad-check__input" />
        <span className="ad-check__box" aria-hidden="true">
          <Icon name="check" size={16} />
        </span>
        <span>{label}</span>
      </label>
      {hint ? <p className="ad-field__hint">{hint}</p> : null}
    </div>
  );
}

export interface SwitchProps {
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: ReactNode;
  id?: string;
  className?: string;
}

export function Switch({
  label,
  checked,
  onCheckedChange,
  disabled,
  hint,
  id,
  className,
}: SwitchProps) {
  const generated = useId();
  const switchId = id ?? generated;
  const labelId = `${switchId}-label`;
  return (
    <div className={cx('ad-switch', className)}>
      <div className="ad-switch__text">
        <span id={labelId} className="ad-field__label">
          {label}
        </span>
        {hint ? <span className="ad-field__hint">{hint}</span> : null}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        className="ad-switch__control"
        aria-checked={checked}
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
      >
        <span className="ad-switch__track" aria-hidden="true">
          <span className="ad-switch__thumb" />
        </span>
        <span className="ad-switch__state">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}
