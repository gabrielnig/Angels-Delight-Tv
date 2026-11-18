import type { Metadata } from 'next';
import { getPwaSettings } from '../../lib/data/pwa-settings';
import { SavedPageLinks, type SavedPage } from '../../components/pwa/SavedPageLinks';
import '../../components/pwa/pwa.css';

const SAVED: SavedPage[] = [
  { href: '/about', label: 'About' },
  { href: '/help', label: 'Help' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
];

export const metadata: Metadata = { title: 'You are offline' };

/**
 * Precached by the service worker and shown when a page cannot load (S34). Plain static text and a link, so it
 * works with JavaScript off (the saved page links need it and simply stay hidden without). It reads no personal data.
 */
export default async function OfflinePage() {
  const { name } = await getPwaSettings();
  return (
    <main className="pwa-offline">
      <h1>You are offline</h1>
      <p>
        Check your data or Wi-Fi, then try again. Nothing has been lost. Videos need a connection to
        play on {name}.
      </p>
      <a className="pwa-btn pwa-btn--primary" href="/">
        Try again
      </a>
      <SavedPageLinks pages={SAVED} />
    </main>
  );
}
