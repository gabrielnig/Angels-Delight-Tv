'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon, Modal } from '@ad/ui';
import { useT } from '../../lib/i18n/provider';

export interface MenuOption<V extends string = string> {
  value: V;
  label: string;
  /** Shorter text for the button when this option is chosen. */
  short?: string;
}

export interface MenuButtonProps<V extends string = string> {
  /** The key shown on the button and used to name the menu, for example Length. */
  name: string;
  /** Shorter key for the button face, for example Sort for Sort by. The full name still names the button. */
  keyLabel?: string;
  options: Array<MenuOption<V>>;
  value: V;
  /** The value that means "not set". The button is tinted for any other value. */
  defaultValue: V;
  onSelect: (value: V) => void;
  /** Results are loading: the button greys and does not open. */
  loading?: boolean;
  /** Called when the menu or sheet opens or closes. */
  onOpenChange?: (open: boolean) => void;
}

const PHONE = '(max-width: 599px)';

function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(PHONE);
    setPhone(query.matches);
    const on = (e: MediaQueryListEvent) => setPhone(e.matches);
    query.addEventListener?.('change', on);
    return () => query.removeEventListener?.('change', on);
  }, []);
  return phone;
}

/** Arrow, Home and End movement over a list of items that all carry data-option. */
function moveFocus(event: React.KeyboardEvent<HTMLElement>, root: HTMLElement | null) {
  const items = Array.from(root?.querySelectorAll<HTMLElement>('[data-option]') ?? []);
  if (items.length === 0) return false;
  const index = items.indexOf(document.activeElement as HTMLElement);
  let next = -1;
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % items.length;
  else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft')
    next = (index - 1 + items.length) % items.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = items.length - 1;
  if (next < 0) return false;
  event.preventDefault();
  items[next]!.focus();
  return true;
}

/**
 * A quiet menu button that shows "Name: value" (S186, D-357). On a desktop it opens a popover menu, on a phone a
 * bottom sheet. Choosing an item applies at once. The button is tinted when a value other than the default is set.
 */
export function MenuButton<V extends string = string>({
  name,
  keyLabel,
  options,
  value,
  defaultValue,
  onSelect,
  loading = false,
  onOpenChange,
}: MenuButtonProps<V>) {
  const msg = useT();
  const phone = usePhone();
  const [open, setOpenState] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value) ?? options[0]!;
  const isSet = value !== defaultValue;

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  // Move focus to the chosen item when the popover opens.
  useEffect(() => {
    if (!open || phone) return;
    const target =
      list.current?.querySelector<HTMLElement>('[aria-checked="true"]') ??
      list.current?.querySelector<HTMLElement>('[data-option]');
    target?.focus();
  }, [open, phone]);

  // A click outside the popover closes it.
  useEffect(() => {
    if (!open || phone) return;
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open, phone, setOpen]);

  // A phone bar can unmount a sheet that is still open (rotation): tell the page.
  useEffect(() => {
    if (!open || !loading) return;
    setOpen(false);
  }, [open, loading, setOpen]);

  function choose(next: V) {
    setOpen(false);
    button.current?.focus();
    if (next !== value) onSelect(next);
  }

  function onListKey(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      button.current?.focus();
      return;
    }
    if (event.key === 'Tab') {
      // Hand focus back to the button first, so Tab moves on from there instead of from a removed item.
      setOpen(false);
      button.current?.focus();
      return;
    }
    moveFocus(event, list.current);
  }

  const items = options.map((option) => {
    const checked = option.value === value;
    return (
      <button
        key={option.value}
        type="button"
        role={phone ? 'radio' : 'menuitemradio'}
        aria-checked={checked}
        data-option=""
        tabIndex={checked ? 0 : -1}
        className="web-menu__option"
        onClick={() => choose(option.value)}
      >
        <span className="web-menu__tick" aria-hidden="true">
          {checked ? <Icon name="check" size={18} /> : null}
        </span>
        {option.label}
      </button>
    );
  });

  return (
    <div className="web-menu" ref={wrap}>
      <button
        ref={button}
        type="button"
        className={`web-menu__button${isSet ? ' is-set' : ''}${loading ? ' is-loading' : ''}`}
        aria-haspopup={phone ? 'dialog' : 'menu'}
        aria-expanded={open}
        aria-controls={open && !phone ? id : undefined}
        aria-disabled={loading ? true : undefined}
        aria-label={msg('browse.bar.buttonName', { name, value: current.label })}
        onClick={() => {
          if (loading) return;
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (loading || phone) return;
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="web-menu__key">{keyLabel ?? name}:</span>{' '}
        <span className="web-menu__value">{current.short ?? current.label}</span>
        <Icon name="chevronDown" size={18} />
      </button>
      {open && !phone ? (
        <div
          id={id}
          ref={list}
          role="menu"
          aria-label={name}
          className="web-menu__popover"
          onKeyDown={onListKey}
        >
          {items}
        </div>
      ) : null}
      {phone ? (
        <Modal open={open} onClose={() => { setOpen(false); }} title={name} className="web-menu__sheet">
          <div
            ref={list}
            role="radiogroup"
            aria-label={name}
            className="web-menu__group"
            onKeyDown={onListKey}
          >
            {items}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
