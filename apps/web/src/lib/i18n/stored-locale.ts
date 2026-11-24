/** The language kept in the browser so the precached offline page can use it without the server (M46-S18). */
export const LOCALE_STORAGE_KEY = 'ad:locale';

export function readStoredLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function rememberLocale(locale: string): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // private mode: the offline page stays English
  }
}
