'use client';

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { QualityMenu } from '../quality';
import { PLAYBACK_RATES, type CaptionTrack } from '../types';
import { CheckIcon } from './icons';

export type MenuId = 'speed' | 'quality' | 'captions' | 'settings';

interface MenuShellProps {
  id: string;
  label: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Popover on desktop, bottom sheet on mobile (CSS decides). Arrow keys move between rows,
 * Escape closes and the caller returns focus to the opening button.
 */
export function MenuShell({ id, label, onClose, children, footer }: MenuShellProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = ref.current?.querySelectorAll<HTMLElement>(
      '[role^="menuitem"]:not([aria-disabled="true"])',
    );
    const checked = ref.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    (checked ?? items?.[0])?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const items = [
      ...(ref.current?.querySelectorAll<HTMLElement>(
        '[role^="menuitem"]:not([aria-disabled="true"])',
      ) ?? []),
    ];
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next = i;
    if (e.key === 'ArrowDown') next = (i + 1) % items.length;
    if (e.key === 'ArrowUp') next = (i - 1 + items.length) % items.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = items.length - 1;
    items[next]?.focus();
  };

  return (
    <div
      ref={ref}
      id={id}
      className="adp-menu"
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      <p className="adp-menu__title" aria-hidden="true">
        {label}
      </p>
      {children}
      {footer}
    </div>
  );
}

interface RowProps {
  label: string;
  detail?: string | undefined;
  checked: boolean;
  disabled?: boolean | undefined;
  hint?: string | undefined;
  onSelect(): void;
}

export function MenuRow({ label, detail, checked, disabled, hint, onSelect }: RowProps) {
  const text = detail ? `${label}, ${detail}` : label;
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      aria-label={hint ? `${text}. ${hint}` : text}
      className="adp-menu__row"
      onClick={() => {
        if (!disabled) onSelect();
      }}
    >
      <span className="adp-menu__check" aria-hidden="true">
        {checked ? <CheckIcon size={16} /> : null}
      </span>
      <span>
        {label}
        {detail ? <span className="adp-menu__detail">{`, ${detail}`}</span> : null}
      </span>
    </button>
  );
}

export function SpeedRows({ rate, onSelect }: { rate: number; onSelect(rate: number): void }) {
  return (
    <>
      {PLAYBACK_RATES.map((r) => (
        <MenuRow
          key={r}
          label={r === 1 ? 'Normal' : `${r}x`}
          checked={rate === r}
          onSelect={() => onSelect(r)}
        />
      ))}
    </>
  );
}

export function QualityRows({
  menu,
  onSelect,
}: {
  menu: QualityMenu;
  onSelect(id: 'auto' | number): void;
}) {
  return (
    <>
      {menu.items.map((item) => (
        <MenuRow
          key={item.id}
          label={item.label}
          detail={item.detail}
          checked={item.selected}
          disabled={item.disabled}
          hint={item.hint}
          onSelect={() => onSelect(item.id === 'auto' ? 'auto' : Number(item.id))}
        />
      ))}
    </>
  );
}

export function CaptionRows({
  tracks,
  active,
  onSelect,
}: {
  tracks: CaptionTrack[];
  active: string | null;
  onSelect(id: string | null): void;
}) {
  return (
    <>
      <MenuRow label="Off" checked={active === null} onSelect={() => onSelect(null)} />
      {tracks.map((t) => (
        <MenuRow
          key={t.id}
          label={t.label}
          checked={active === t.id}
          onSelect={() => onSelect(t.id)}
        />
      ))}
    </>
  );
}
