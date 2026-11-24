'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';

export interface BulkBarAction {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  /** Why the action is unavailable. The button keeps aria-disabled so it stays focusable and shows this. */
  disabledReason?: string;
  /** Secondary actions sit in a More menu on narrow screens. */
  secondary?: boolean;
}

export interface BulkBarProps {
  count: number;
  onClear: () => void;
  actions: BulkBarAction[];
  /** Offered only when the page is fully selected and more rows match the filter. */
  pageFullySelected?: boolean;
  matchTotal?: number;
  onSelectMatching?: () => void;
  note?: ReactNode;
  /** Where focus goes after Clear, normally the table. */
  returnFocusTo?: () => HTMLElement | null;
}

function ActionButton({ action }: { action: BulkBarAction }) {
  const tipId = useId();
  const blocked = Boolean(action.disabledReason);
  return (
    <span className="adm-bulk__action">
      <button
        type="button"
        className={`adm-btn adm-btn--${action.variant === 'primary' ? 'accent' : action.variant === 'danger' ? 'danger' : 'secondary'}${action.secondary ? ' adm-bulk__secondary' : ''}`}
        aria-disabled={blocked ? 'true' : undefined}
        aria-describedby={blocked ? tipId : undefined}
        onClick={() => {
          if (!blocked) action.onClick();
        }}
      >
        {action.label}
      </button>
      {blocked ? (
        <span id={tipId} role="tooltip" className="adm-sr">
          {action.disabledReason}
        </span>
      ) : null}
    </span>
  );
}

/** The one selection bar (M42-S03). Count is announced politely, actions carry their reasons. */
export function BulkBar({
  count,
  onClear,
  actions,
  pageFullySelected,
  matchTotal,
  onSelectMatching,
  note,
  returnFocusTo,
}: BulkBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    wrapRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const away = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [menuOpen]);
  const onMenuKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setMenuOpen(false);
      moreRef.current?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(wrapRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const at = items.indexOf(document.activeElement as HTMLElement);
    const step = e.key === 'ArrowDown' ? 1 : -1;
    items[(at + step + items.length) % items.length]?.focus();
  };
  const menuId = useId();
  const secondary = actions.filter((a) => a.secondary);
  const showAll = Boolean(pageFullySelected && onSelectMatching && matchTotal !== undefined && matchTotal > count);

  return (
    <div className="adm-bulk" role="region" aria-label="Bulk actions">
      <span role="status" aria-live="polite" className="adm-bulk__count">
        {count} selected
      </span>
      {showAll ? (
        <button type="button" className="adm-bulk__all" onClick={onSelectMatching}>
          Select all {matchTotal} that match
        </button>
      ) : null}
      {note ? <span className="adm-bulk__note">{note}</span> : null}
      <div className="adm-bulk__actions">
        {actions.map((action) => (
          <ActionButton key={action.id} action={action} />
        ))}
        {secondary.length > 0 ? (
          <span className="adm-bulk__morewrap" ref={wrapRef}>
            <button
              ref={moreRef}
              type="button"
              className="adm-btn adm-btn--secondary adm-bulk__more"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuId : undefined}
              onClick={() => setMenuOpen((open) => !open)}
            >
              More
            </button>
            {menuOpen ? (
              <ul id={menuId} role="menu" className="adm-bulk__menu" onKeyDown={onMenuKey}>
                {secondary.map((action) => {
                  const blocked = Boolean(action.disabledReason);
                  return (
                    <li key={action.id} role="none">
                      <button
                        type="button"
                        role="menuitem"
                        className={`adm-bulk__menuitem${action.variant === 'danger' ? ' is-danger' : ''}`}
                        aria-disabled={blocked ? 'true' : undefined}
                        onClick={() => {
                          if (blocked) return;
                          setMenuOpen(false);
                          action.onClick();
                        }}
                      >
                        {action.label}
                        {blocked ? <span className="adm-sr">{`. ${action.disabledReason}`}</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        className="adm-btn adm-btn--ghost adm-bulk__clear"
        onClick={() => {
          onClear();
          returnFocusTo?.()?.focus();
        }}
      >
        Clear
      </button>
    </div>
  );
}
