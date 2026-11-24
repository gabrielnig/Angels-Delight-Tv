'use client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { EN_NG, createMessages, type CatalogShape, type Translate } from '@ad/shared/messages';

interface I18nValue {
  locale: string;
  t: Translate;
}
const I18nContext = createContext<I18nValue | null>(null);

/** Carries one locale and only the namespaces the route needs. English comes from the shared catalog. */
export function I18nProvider({
  locale,
  catalog,
  children,
}: {
  locale: string;
  catalog: CatalogShape;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: createMessages(locale, { 'en-NG': EN_NG as unknown as CatalogShape, [locale]: catalog }, () => {}),
    }),
    [locale, catalog],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** The translator for client components. Without a provider it reads English. */
export function useT(): Translate {
  const ctx = useContext(I18nContext);
  return useMemo(() => ctx?.t ?? createMessages('en', { 'en-NG': EN_NG as unknown as CatalogShape }, () => {}), [ctx]);
}

export function useLocale(): string {
  return useContext(I18nContext)?.locale ?? 'en';
}
