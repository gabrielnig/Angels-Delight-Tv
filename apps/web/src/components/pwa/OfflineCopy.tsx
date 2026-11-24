'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { readStoredLocale } from '../../lib/i18n/stored-locale';
import './pwa.css';

export interface OfflineStrings {
  banner: string;
  title: string;
  body: string;
  retry: string;
}

/**
 * The offline screen text in every enabled language. The page is precached once, so it is rendered in English
 * and switches to the language kept in localStorage (ad:locale). Without JavaScript or a stored choice it stays
 * English, which is the fallback for any language that is not in the table.
 */
export function OfflineCopy({
  table,
  read = readStoredLocale,
  children,
}: {
  table: Record<string, OfflineStrings>;
  read?: () => string | null;
  children?: ReactNode;
}) {
  const [locale, setLocale] = useState('en');
  useEffect(() => {
    try {
      const stored = read();
      setLocale(stored && table[stored] ? stored : 'en');
    } catch {
      setLocale('en');
    }
  }, [read, table]);
  const text = table[locale] ?? table['en']!;
  return (
    <div lang={locale === 'en' ? undefined : locale}>
      <p role="status" className="pwa-offline__banner">
        {text.banner}
      </p>
      <div className="ad-error">
        <h1>{text.title}</h1>
        <p>{text.body}</p>
        <a className="pwa-btn pwa-btn--primary" href="/">
          {text.retry}
        </a>
      </div>
      {children}
    </div>
  );
}
