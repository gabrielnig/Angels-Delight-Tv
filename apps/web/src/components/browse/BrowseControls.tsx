'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@ad/ui';
import type { BrowseLength, BrowseSort } from '../../lib/data';
import { useT } from '../../lib/i18n/provider';
import { CategoryRail, type RailItem } from './CategoryRail';
import { MenuButton, type MenuOption } from './MenuButton';
import { nextBarHidden } from './browse-bar-state';
import { browseHref } from './browse-filters';
import './browse-controls.css';

export interface BrowseControlsProps {
  /** The page path without a query, for example /browse or /browse/science. */
  base: string;
  length: BrowseLength;
  sort: BrowseSort;
  railLabel: string;
  railItems: RailItem[];
  lengthOptions: Array<MenuOption<BrowseLength>>;
  sortOptions: Array<MenuOption<BrowseSort>>;
}

const PHONE = '(max-width: 599px)';

/**
 * The category rail and the Length and Sort bar, pinned under the nav (S186, D-357). Choices apply at once and live
 * in the URL. On phones the bar slides away on scroll down and returns on scroll up. The rail stays.
 */
export function BrowseControls({
  base,
  length,
  sort,
  railLabel,
  railItems,
  lengthOptions,
  sortOptions,
}: BrowseControlsProps) {
  const msg = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const stack = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const lastY = useRef(0);
  const locked = useRef(false);
  locked.current = menuOpen || focusInside;

  useEffect(() => {
    lastY.current = window.scrollY;
    function onScroll() {
      const el = stack.current;
      if (!el) return;
      const y = window.scrollY;
      const pinnedAt = parseFloat(getComputedStyle(el).top) || 0;
      const isStuck = el.getBoundingClientRect().top <= pinnedAt + 1;
      setStuck(isStuck);
      const phone = typeof window.matchMedia === 'function' && window.matchMedia(PHONE).matches;
      // Copy what the updater reads: it can run after lastY moves on.
      const from = lastY.current;
      const isLocked = locked.current;
      setHidden((was) =>
        phone
          ? nextBarHidden({ hidden: was, y, lastY: from, stuck: isStuck, locked: isLocked })
          : false,
      );
      lastY.current = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function go(nextLength: BrowseLength, nextSort: BrowseSort) {
    startTransition(() => router.push(browseHref(base, nextLength, nextSort)));
  }

  const isSet = length !== 'any' || sort !== 'newest';

  return (
    <div className="web-browse-stack" ref={stack} data-stuck={stuck ? 'true' : 'false'}>
      <CategoryRail label={railLabel} items={railItems} />
      <div
        className="web-browse-bar"
        role="group"
        aria-label={msg('browse.bar.label')}
        aria-busy={pending || undefined}
        data-hidden={hidden ? 'true' : 'false'}
        inert={hidden || undefined}
        onFocus={() => setFocusInside(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusInside(false);
        }}
      >
        <MenuButton
          name={msg('browse.bar.length')}
          options={lengthOptions}
          value={length}
          defaultValue="any"
          loading={pending}
          onOpenChange={setMenuOpen}
          onSelect={(next) => go(next, sort)}
        />
        <MenuButton
          name={msg('browse.bar.sortName')}
          keyLabel={msg('browse.bar.sort')}
          options={sortOptions}
          value={sort}
          defaultValue="newest"
          loading={pending}
          onOpenChange={setMenuOpen}
          onSelect={(next) => go(length, next)}
        />
        {isSet ? (
          <Link
            className="web-browse-bar__clear"
            href={browseHref(base, 'any', 'newest')}
            aria-label={msg('browse.bar.clearLabel')}
          >
            {msg('browse.bar.clear')}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
