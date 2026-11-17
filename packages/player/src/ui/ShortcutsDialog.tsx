import { useEffect, useRef, type KeyboardEvent } from 'react';
import { SHORTCUT_HELP } from '../keyboard';

/** Screen 26. Focus is trapped, Escape closes and focus returns to the caller. */
export function ShortcutsDialog({ onClose }: { onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    return () => previous?.focus?.();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = ref.current?.querySelectorAll<HTMLElement>(
      'button, a[href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="adp-dialog-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className="adp-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adp-shortcuts-title"
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="adp-shortcuts-title" className="adp-dialog__title">
          Keyboard shortcuts
        </h2>
        <p className="adp-dialog__lead">These work when the player has focus.</p>
        <dl className="adp-dialog__list">
          {SHORTCUT_HELP.map((row) => (
            <div key={row.action} className="adp-dialog__row">
              <dt>
                {row.keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </dt>
              <dd>{row.action}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="adp-btn adp-btn--primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
