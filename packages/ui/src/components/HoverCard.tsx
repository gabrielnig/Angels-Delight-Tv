'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';

/** The pointer must rest this long before the card opens, so passing across a row opens nothing (R10). */
export const HOVER_CARD_DELAY_MS = 300;
/** Time to move from the tile onto the card without it closing. */
export const HOVER_CARD_GRACE_MS = 100;
export const HOVER_CARD_SCALE = 1.25;
const EDGE_MARGIN = 8;

export type HoverCardOrigin = 'left' | 'center' | 'right';

interface Place {
  left: number;
  top: number;
  width: number;
  origin: HoverCardOrigin;
}

const HOVER_QUERY = '(hover: hover) and (pointer: fine)';
const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

let closeOpen: (() => void) | null = null;

/** Where the card grows from: it cannot grow past the row edge, so the first card grows right and the last left. */
function originFor(anchor: HTMLElement, rect: DOMRect): HoverCardOrigin {
  const row = anchor.closest('.ad-row')?.getBoundingClientRect();
  const min = Math.max(0, row?.left ?? 0);
  const max = Math.min(window.innerWidth, row && row.right > 0 ? row.right : window.innerWidth);
  const growth = (rect.width * (HOVER_CARD_SCALE - 1)) / 2;
  if (rect.left - growth < min + EDGE_MARGIN) return 'left';
  if (rect.right + growth > max - EDGE_MARGIN) return 'right';
  return 'center';
}

/**
 * Opens a hover card for a tile after the pointer rests on it. Mouse and trackpad only: touch, pen, keyboard focus and
 * devices without hover never open it. One card is open at a time, Escape and leaving both close it.
 */
export function useHoverCard() {
  const anchorRef = useRef<HTMLElement | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [reduced, setReduced] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clear = () => clearTimeout(timer.current);
  const close = useCallback(() => {
    clearTimeout(timer.current);
    setPlace(null);
    if (closeOpen === close) closeOpen = null;
  }, []);

  const hoverable = (event: PointerEvent) =>
    event.pointerType !== 'touch' &&
    event.pointerType !== 'pen' &&
    window.matchMedia?.(HOVER_QUERY).matches === true;

  const onAnchorEnter = (event: PointerEvent) => {
    clear();
    if (!hoverable(event)) return;
    timer.current = setTimeout(() => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      closeOpen?.();
      closeOpen = close;
      setReduced(window.matchMedia?.(MOTION_QUERY).matches === true);
      setPlace({ left: rect.left, top: rect.top, width: rect.width, origin: originFor(el, rect) });
    }, HOVER_CARD_DELAY_MS);
  };
  const onLeave = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    clear();
    timer.current = setTimeout(close, HOVER_CARD_GRACE_MS);
  };
  const onCardEnter = () => clear();

  const open = place !== null;
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (closeOpen === close) closeOpen = null;
    },
    [close],
  );

  return {
    anchorRef,
    open,
    anchorProps: { onPointerEnter: onAnchorEnter, onPointerLeave: onLeave },
    cardProps: {
      place,
      reduced,
      onPointerEnter: onCardEnter,
      onPointerLeave: onLeave,
    },
  };
}

/** The floating card. It sits over the tile in the body, so a row that scrolls or clips cannot cut it off. */
export function HoverCard({
  place,
  reduced,
  label,
  onPointerEnter,
  onPointerLeave,
  children,
}: {
  place: Place | null;
  reduced: boolean;
  label: string;
  onPointerEnter: () => void;
  onPointerLeave: (event: PointerEvent) => void;
  children: ReactNode;
}) {
  if (!place || typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="dialog"
      aria-label={label}
      className="ad-hovercard"
      data-origin={place.origin}
      data-motion={reduced ? 'reduced' : undefined}
      style={{
        left: place.left,
        top: place.top,
        width: place.width,
        transformOrigin: `${place.origin} top`,
        transform: reduced ? undefined : `scale(${HOVER_CARD_SCALE})`,
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </div>,
    document.body,
  );
}
