'use client';

import { useEffect, useRef } from 'react';
import { Icon } from '../Icon';

/** A plain GET form, so search works without script. The slash key focuses it when nobody is typing. */
export function SearchBox({
  action,
  label,
  defaultValue = '',
  name = 'q',
  placeholder,
  button = 'Search',
}: {
  action: string;
  label: string;
  defaultValue?: string;
  name?: string;
  placeholder?: string;
  button?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      ref.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <form action={action} method="get" role="search" className="hlp-search">
      <label className="hlp-search__label" htmlFor={`hlp-box-${name}`}>
        {label}
      </label>
      <div className="hlp-search__row">
        <span className="hlp-search__field">
          <Icon name="search" size={18} />
          <input
            ref={ref}
            id={`hlp-box-${name}`}
            type="search"
            name={name}
            defaultValue={defaultValue}
            placeholder={placeholder}
            autoComplete="off"
            enterKeyHint="search"
            aria-label={label}
          />
        </span>
        <button type="submit" className="adm-btn adm-btn--primary">
          {button}
        </button>
      </div>
    </form>
  );
}
