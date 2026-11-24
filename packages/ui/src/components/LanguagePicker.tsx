'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from './Icon';

export interface PickerLocale {
  code: string;
  endonym: string;
  englishName: string;
  htmlLang: string;
}

export interface LanguagePickerLabels {
  /** Accessible name of the button. */
  button: string;
  menu: string;
  /** Shown under the list when the chosen language is not fully translated. */
  stillEnglish: string;
}

/**
 * Language choice for guests and accounts (M46). Shows nothing when fewer than two languages are enabled. Rows are
 * radio menu items named in their own language, with the English name beneath. Under 240 px only the globe shows.
 */
export function LanguagePicker({
  locales,
  current,
  onSelect,
  labels,
  incomplete = false,
}: {
  locales: readonly PickerLocale[];
  current: string;
  onSelect: (code: string) => void;
  labels: LanguagePickerLabels;
  incomplete?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const items = menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]');
    const checked = Array.from(items ?? []).find((i) => i.getAttribute('aria-checked') === 'true');
    (checked ?? items?.[0])?.focus();
    const away = (event: MouseEvent) => {
      const t = event.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  if (locales.length < 2) return null;
  const active = locales.find((l) => l.code === current) ?? locales[0]!;

  function close() {
    setOpen(false);
    button.current?.focus();
  }
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    event.preventDefault();
    items[next]?.focus();
  }

  return (
    <div className="ad-langpicker">
      <button
        ref={button}
        type="button"
        className="ad-langpicker__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={labels.button}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="globe" size={22} />
        <span className="ad-langpicker__current" lang={active.htmlLang}>
          {active.endonym}
        </span>
      </button>
      {open ? (
        <div ref={menu} className="ad-langpicker__menu" role="menu" aria-label={labels.menu} onKeyDown={onKeyDown}>
          {locales.map((locale) => (
            <button
              key={locale.code}
              type="button"
              role="menuitemradio"
              aria-checked={locale.code === current}
              lang={locale.htmlLang}
              className="ad-langpicker__item"
              onClick={() => {
                onSelect(locale.code);
                close();
              }}
            >
              <span className="ad-langpicker__endonym">{locale.endonym}</span>
              <span className="ad-langpicker__english" lang="en">
                {locale.englishName}
              </span>
              {locale.code === current ? <Icon name="check" size={18} /> : null}
            </button>
          ))}
          {incomplete ? <p className="ad-langpicker__hint">{labels.stillEnglish}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
