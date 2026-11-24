import type { Metadata } from 'next';
import { getPwaSettings } from '../../lib/data/pwa-settings';
import { SavedPageLinks, type SavedPage } from '../../components/pwa/SavedPageLinks';
import { OfflineCopy, type OfflineStrings } from '../../components/pwa/OfflineCopy';
import { themeRuntime } from '../../lib/data/admin/theme-runtime';
import { getTranslator } from '../../lib/i18n/server';
import { normalizeLocale } from '@ad/shared/messages';
import '../../components/pwa/pwa.css';

const SAVED: SavedPage[] = [
  { href: '/about', label: 'About' },
  { href: '/help', label: 'Help' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
];

export const metadata: Metadata = {
  title: 'You are offline',
  robots: { index: false, follow: false },
};

/** The offline text for every enabled interface language. English is always present as the fallback. */
async function offlineTable(name: string): Promise<Record<string, OfflineStrings>> {
  let enabled: string[] = ['en'];
  try {
    enabled = await (await themeRuntime()).settings.get('content.ui_languages');
  } catch {
    enabled = ['en'];
  }
  const codes = [
    ...new Set(['en', ...enabled.map((c) => normalizeLocale(c)).filter(Boolean)]),
  ] as never[];
  const entries = await Promise.all(
    codes.map(async (code: string) => {
      const msg = await getTranslator(code as never);
      return [
        code,
        {
          banner: msg('offline.banner'),
          title: msg('offline.title'),
          body: msg('offline.body', { name }),
          retry: msg('offline.retry'),
        },
      ] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Precached by the service worker and shown when a page cannot load (S34). Static text and a link, so it works
 * with JavaScript off (the saved page links need it and simply stay hidden without). It reads no personal data.
 * The text is in every enabled language and the one stored in the browser is shown (M46-S18).
 */
export default async function OfflinePage() {
  const { name } = await getPwaSettings();
  const table = await offlineTable(name);
  return (
    <main className="pwa-offline">
      <OfflineCopy table={table}>
        <SavedPageLinks pages={SAVED} />
      </OfflineCopy>
    </main>
  );
}
