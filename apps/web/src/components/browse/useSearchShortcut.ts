'use client';

import { useEffect } from 'react';

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

/** Pressing / focuses the search box, or opens the search page, unless the viewer is typing (M06-S08 AC1). */
export function useSearchShortcut(go: (href: string) => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as Element | null;
      if (target?.closest?.(EDITABLE)) return;
      event.preventDefault();
      const box = document.querySelector<HTMLInputElement>('input[type="search"]');
      if (box) box.focus();
      else go('/search');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go]);
}
