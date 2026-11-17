'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@ad/ui';
import type { Suggestion } from '../../lib/data';

const STORAGE_KEY = 'ad-recent-searches';
const MAX_RECENT = 5;

interface Option {
  id: string;
  label: string;
  kind: 'video' | 'category' | 'recent';
  href?: string;
}

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable, recent searches are optional */
  }
}

export interface SearchBoxProps {
  onSearch: (q: string) => void;
  onNavigate: (href: string) => void;
  loadSuggestions: (q: string) => Promise<Suggestion[]>;
  initialValue?: string;
  debounceMs?: number;
  autoFocus?: boolean;
}

/** Search combobox (ARIA 1.2 list autocomplete) with debounced suggestions and device-local recent searches. */
export function SearchBox({
  onSearch,
  onNavigate,
  loadSuggestions,
  initialValue = '',
  debounceMs = 250,
  autoFocus,
}: SearchBoxProps) {
  const uid = useId();
  const listId = `${uid}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const seq = useRef(0);

  const query = value.trim();
  const showingRecent = query === '' && recent.length > 0;
  const options: Option[] = showingRecent
    ? recent.slice(0, MAX_RECENT).map((label, i) => ({ id: `${uid}-o${i}`, label, kind: 'recent' }))
    : suggestions.map((s, i) => ({
        id: `${uid}-o${i}`,
        label: s.label,
        kind: s.type,
        href: s.href,
      }));
  const expanded = open && options.length > 0;

  useEffect(() => {
    if (query === '') {
      setSuggestions([]);
      return;
    }
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      loadSuggestions(query)
        .then((result) => {
          if (mine === seq.current) setSuggestions(result);
        })
        .catch(() => {
          if (mine === seq.current) setSuggestions([]);
        });
    }, debounceMs);
    return () => clearTimeout(timer);
    // loadSuggestions identity is intentionally not a dependency; callers pass inline functions.
  }, [query, debounceMs]);

  function remember(q: string) {
    const next = [q, ...readRecent().filter((r) => r !== q)].slice(0, 10);
    writeRecent(next);
    setRecent(next);
  }

  function submit(q: string) {
    const clean = q.trim();
    if (!clean) return;
    remember(clean);
    setOpen(false);
    onSearch(clean);
  }

  function choose(option: Option) {
    setOpen(false);
    if (option.kind === 'recent') {
      setValue(option.label);
      submit(option.label);
    } else if (option.href) {
      onNavigate(option.href);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!expanded) setOpen(true);
      setActive((i) => (options.length ? (i + 1) % options.length : -1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (options.length ? (i <= 0 ? options.length - 1 : i - 1) : -1));
    } else if (event.key === 'Escape') {
      if (expanded) {
        event.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = expanded ? options[active] : undefined;
      if (option) choose(option);
      else submit(value);
    }
  }

  const activeOption = expanded ? options[active] : undefined;

  return (
    <div className="web-search">
      <div className="web-search__field">
        <Icon name="search" size={20} aria-hidden="true" />
        <input
          ref={inputRef}
          className="web-search__input"
          role="combobox"
          type="search"
          enterKeyHint="search"
          aria-label="Search videos"
          placeholder="Search videos"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus={autoFocus}
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={activeOption?.id}
          value={value}
          onFocus={() => {
            setRecent(readRecent());
            setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            setValue(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        {value ? (
          <button
            type="button"
            className="web-search__clear"
            aria-label="Clear search"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setValue('');
              setActive(-1);
              setRecent(readRecent());
              setOpen(true);
              inputRef.current?.focus();
            }}
          >
            <Icon name="close" size={20} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {expanded ? (
        <div className="web-search__panel" onMouseDown={(event) => event.preventDefault()}>
          {showingRecent ? (
            <div className="web-search__head">
              <span>Recent searches</span>
              <button
                type="button"
                className="web-search__clearall"
                onClick={() => {
                  writeRecent([]);
                  setRecent([]);
                  setOpen(false);
                }}
              >
                Clear all
              </button>
            </div>
          ) : null}
          <ul
            id={listId}
            role="listbox"
            aria-label={showingRecent ? 'Recent searches' : 'Suggestions'}
            className="web-search__list"
          >
            {options.map((option, i) => (
              <li
                key={option.id}
                id={option.id}
                role="option"
                aria-selected={i === active}
                aria-label={option.kind === 'category' ? `${option.label}, Category` : option.label}
                className="web-search__option"
                data-active={i === active || undefined}
                onClick={() => choose(option)}
              >
                <Icon
                  name={option.kind === 'recent' ? 'clock' : 'search'}
                  size={20}
                  aria-hidden="true"
                />
                <span>{option.label}</span>
                {option.kind === 'category' ? (
                  <span className="web-search__tag">Category</span>
                ) : null}
              </li>
            ))}
          </ul>
          {showingRecent ? <p className="web-search__note">Saved on this device only.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
