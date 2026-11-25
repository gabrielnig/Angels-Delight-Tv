'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, Link } from '@ad/ui';
import { useT } from '../../lib/i18n/provider';
import './browse-rail.css';

export interface RailItem {
  href: string;
  label: string;
  current: boolean;
}

/** How far an arrow pages: most of a screenful, so the last chip seen stays in view. */
const PAGE_FRACTION = 0.8;
/** Tolerance for sub pixel scroll positions. */
const EDGE_SLACK = 2;

/**
 * One row of category chips that never wraps (S186). Native scroll snap, fading edges that show more chips,
 * arrow buttons on fine pointers only, and the selected chip is centred when the rail mounts. Every chip is a
 * link in the normal tab order, so keyboard users need no extra keys.
 */
export function CategoryRail({ label, items }: { label: string; items: RailItem[] }) {
  const msg = useT();
  const scroller = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const start = el.scrollLeft > EDGE_SLACK;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - EDGE_SLACK;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const current = el.querySelector<HTMLElement>('[aria-current="page"]')?.closest('li');
    if (current instanceof HTMLElement) {
      const left = current.offsetLeft + current.offsetWidth / 2 - el.clientWidth / 2;
      if (left > 0) el.scrollLeft = left;
    }
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  function page(direction: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({
      left: direction * Math.round(el.clientWidth * PAGE_FRACTION),
      behavior: reduce ? 'auto' : 'smooth',
    });
  }

  return (
    <nav aria-label={label}>
      <div
        className={`web-rail${edges.start ? ' can-start' : ''}${edges.end ? ' can-end' : ''}`}
      >
        <span className="web-rail__fade web-rail__fade--start" aria-hidden="true" />
        <span className="web-rail__fade web-rail__fade--end" aria-hidden="true" />
        <button
          type="button"
          className="web-rail__arrow web-rail__arrow--start"
          aria-label={msg('browse.rail.previous')}
          onClick={() => page(-1)}
        >
          <Icon name="chevronLeft" size={22} />
        </button>
        <ul className="web-rail__scroller" onScroll={measure} ref={scroller}>
          {items.map((item) => (
            <li className="web-rail__item" key={item.href}>
              <Link
                className="web-rail__link"
                href={item.href}
                aria-current={item.current ? 'page' : undefined}
              >
                <span className="web-rail__chip">
                  {item.current ? <Icon name="check" size={16} /> : null}
                  {item.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="web-rail__arrow web-rail__arrow--end"
          aria-label={msg('browse.rail.next')}
          onClick={() => page(1)}
        >
          <Icon name="chevronRight" size={22} />
        </button>
      </div>
    </nav>
  );
}
