'use client';

import { useEffect, useState } from 'react';
import './pwa.css';

export interface SavedPage {
  href: string;
  label: string;
}

const defaultHas = async (href: string) =>
  typeof caches !== 'undefined' && (await caches.match(href)) !== undefined;

/** Links on the offline screen to public pages that were saved on this device (M25-S04). Hidden when none. */
export function SavedPageLinks({
  pages,
  has = defaultHas,
}: {
  pages: SavedPage[];
  has?: (href: string) => Promise<boolean>;
}) {
  const [saved, setSaved] = useState<SavedPage[]>([]);
  useEffect(() => {
    let live = true;
    void Promise.all(pages.map((page) => has(page.href).catch(() => false))).then((flags) => {
      if (live) setSaved(pages.filter((_, index) => flags[index]));
    });
    return () => {
      live = false;
    };
  }, [pages, has]);
  if (saved.length === 0) return null;
  return (
    <nav aria-label="Pages saved on this device" className="pwa-saved">
      <p>You can still read these pages offline.</p>
      <ul>
        {saved.map((page) => (
          <li key={page.href}>
            <a href={page.href}>{page.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
