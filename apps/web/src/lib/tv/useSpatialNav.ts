'use client';
import { useEffect } from 'react';
import { nextFocus, type Direction, type FocusRect } from './spatial-nav';

const FOCUSABLE =
  'a[href], button, input:not([type="hidden"]), textarea, select, summary, [tabindex]:not([tabindex="-1"]), [data-focusable]';
const NATIVE = /^(A|BUTTON|INPUT|TEXTAREA|SELECT|SUMMARY)$/;
const MODAL = '[role="dialog"][aria-modal="true"], dialog[open]';
const ARROWS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

type Measure = (el: HTMLElement) => FocusRect;

function usable(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled) return false;
  return !el.closest('[hidden], [aria-hidden="true"], [inert]');
}

/** Visible, enabled, non empty focus targets under `root`, in document order. Exported for tests. */
export function collectFocusables(root: ParentNode, measure: Measure): HTMLElement[] {
  const found: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>(FOCUSABLE).forEach((el) => {
    if (!usable(el)) return;
    const r = measure(el);
    if (r.right - r.left <= 0 || r.bottom - r.top <= 0) return;
    found.push(el);
  });
  return found;
}

function isTextField(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const t = (el as HTMLInputElement).type;
    return ![
      'button',
      'checkbox',
      'radio',
      'submit',
      'reset',
      'range',
      'file',
      'image',
      'color',
    ].includes(t);
  }
  return (el as HTMLElement).isContentEditable === true;
}

function isBack(e: KeyboardEvent): boolean {
  return (
    e.key === 'Escape' ||
    e.key === 'XF86Back' ||
    e.key === 'GoBack' ||
    e.keyCode === 10009 ||
    e.keyCode === 461
  );
}

const measureEl: Measure = (el) => {
  const r = el.getBoundingClientRect();
  return { id: '', left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};

/**
 * D-pad navigation (M49-S15). When enabled, arrow keys move focus to the nearest control in that direction, Enter
 * activates a non native `[data-focusable]`, and the back keys go back. It never traps focus: at an edge the key
 * is left alone, and an open modal dialog confines movement to itself and keeps its own Escape.
 */
export function useSpatialNav({ enabled }: { enabled: boolean }): void {
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const active = document.activeElement as HTMLElement | null;
      const modal = document.querySelector<HTMLElement>(MODAL);

      if (isBack(e)) {
        if (modal) return;
        if (e.key === 'Escape' && isTextField(active)) {
          active?.blur();
          e.preventDefault();
          return;
        }
        e.preventDefault();
        window.history.back();
        return;
      }

      if (e.key === 'Enter') {
        if (active && !NATIVE.test(active.tagName) && active.hasAttribute('data-focusable')) {
          e.preventDefault();
          active.click();
        }
        return;
      }

      const dir = ARROWS[e.key];
      if (!dir) return;
      if (active?.tagName === 'SELECT') return;
      if (isTextField(active) && (dir === 'left' || dir === 'right')) return;

      const root: ParentNode = modal ?? document;
      const list = collectFocusables(root, measureEl);
      if (active && active !== document.body && root.contains(active) && !list.includes(active)) {
        list.push(active);
      }
      const current = active && list.indexOf(active);
      let target: HTMLElement | undefined;
      if (current === null || current === undefined || current < 0) {
        target = list[0];
      } else {
        const rects = list.map((el, i) => ({ ...measureEl(el), id: String(i) }));
        const id = nextFocus(rects, String(current), dir);
        target = id === null ? undefined : list[Number(id)];
      }
      if (!target) return;
      e.preventDefault();
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
