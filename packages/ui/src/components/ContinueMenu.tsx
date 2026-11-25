'use client';

import { useEffect, useRef, useState } from 'react';
import { IconButton } from './Button';
import { Link } from './Link';

export interface ContinueMenuLabels {
  /** Accessible name of the kebab. `{title}` is replaced. */
  more: string;
  remove: string;
  goToTitle: string;
  /** Name of the Share item. It shows only when `onShare` is given. */
  share?: string;
}

/**
 * The three dot menu on a Continue learning card (M44-S15). A real `role="menu"` with arrow keys, Home, End,
 * Enter, Escape and focus return. The kebab keeps a 44px target and shows on hover or focus on a fine pointer.
 */
export function ContinueMenu({
  title,
  titleHref,
  labels,
  onRemove,
  onShare,
}: {
  title: string;
  titleHref: string;
  labels: ContinueMenuLabels;
  onRemove: () => void;
  onShare?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const menuItems = () =>
    Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) root.current?.querySelector<HTMLElement>('button[aria-haspopup]')?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const list = menuItems();
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      list[(index + 1) % list.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      list[(index - 1 + list.length) % list.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      list[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      list[list.length - 1]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div className="ad-card__action ad-continue-menu" ref={root} onKeyDown={open ? onKeyDown : undefined}>
      <IconButton
        variant="on-dark"
        icon="more"
        iconSize={20}
        label={labels.more.replace('{title}', title)}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      />
      {open ? (
        <div role="menu" className="ad-continue-menu__list" aria-label={labels.more.replace('{title}', title)}>
          <button
            type="button"
            role="menuitem"
            className="ad-continue-menu__item"
            onClick={() => {
              close(false);
              onRemove();
            }}
          >
            {labels.remove}
          </button>
          <Link
            href={titleHref}
            role="menuitem"
            className="ad-continue-menu__item"
            onClick={() => close(false)}
          >
            {labels.goToTitle}
          </Link>
          {onShare && labels.share ? (
            <button
              type="button"
              role="menuitem"
              className="ad-continue-menu__item"
              onClick={() => {
                close(false);
                onShare();
              }}
            >
              {labels.share}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
