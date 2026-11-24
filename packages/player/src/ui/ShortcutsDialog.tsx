'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { SHORTCUT_HELP } from '../keyboard';
import { usePlayerT } from '../t';

/** Screen 26. Focus is trapped, Escape closes and focus returns to the caller. */
export function ShortcutsDialog({ onClose }: { onClose(): void }) {
  const msg = usePlayerT();
  const ref = useRef<HTMLDivElement>(null);
  const keyNames: Record<string, string> = {
    Space: msg('player.shortcuts.key.space'),
    Left: msg('player.shortcuts.key.left'),
    Right: msg('player.shortcuts.key.right'),
    Up: msg('player.shortcuts.key.up'),
    Down: msg('player.shortcuts.key.down'),
    Esc: msg('player.shortcuts.key.esc'),
    '0 to 9': msg('player.shortcuts.key.digits'),
    'Shift ,': msg('player.shortcuts.key.shiftComma'),
    'Shift .': msg('player.shortcuts.key.shiftPeriod'),
  };
  const actions: Record<string, string> = {
    playPause: msg('player.shortcuts.row.playPause'),
    back5: msg('player.shortcuts.row.back5'),
    back10: msg('player.shortcuts.row.back10'),
    volume: msg('player.shortcuts.row.volume'),
    mute: msg('player.shortcuts.row.mute'),
    captions: msg('player.shortcuts.row.captions'),
    fullscreen: msg('player.shortcuts.row.fullscreen'),
    jump: msg('player.shortcuts.row.jump'),
    speed: msg('player.shortcuts.row.speed'),
    next: msg('player.shortcuts.row.next'),
    skip: msg('player.shortcuts.row.skip'),
    theatre: msg('player.shortcuts.row.theatre'),
    escape: msg('player.shortcuts.row.escape'),
    help: msg('player.shortcuts.row.help'),
  };

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
          {msg('player.settings.shortcuts')}
        </h2>
        <p className="adp-dialog__lead">{msg('player.shortcuts.lead')}</p>
        <dl className="adp-dialog__list">
          {SHORTCUT_HELP.map((row) => (
            <div key={row.action} className="adp-dialog__row">
              <dt>
                {row.keys.map((k) => (
                  <kbd key={k}>{keyNames[k] ?? k}</kbd>
                ))}
              </dt>
              <dd>{actions[row.id] ?? row.action}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="adp-btn adp-btn--primary" onClick={onClose}>
          {msg('player.shortcuts.close')}
        </button>
      </div>
    </div>
  );
}
