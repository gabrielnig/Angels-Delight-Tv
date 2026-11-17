import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@ad/ui/tokens.css';
import './globals.css';
import { WebVitals } from '../components/observability/WebVitals';
import { PwaClient } from '../components/pwa/PwaClient';
import { getPwaSettings } from '../lib/data/pwa-settings';
import { DEFAULT_PLATFORM_NAME } from '../lib/platform';

export const metadata: Metadata = {
  title: DEFAULT_PLATFORM_NAME,
  description: 'Free learning videos for everyone.',
  icons: { apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: DEFAULT_PLATFORM_NAME, statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#1F6FB5',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { name } = await getPwaSettings();
  return (
    <html lang="en">
      <body>
        {children}
        <PwaClient platformName={name} />
        <WebVitals />
      </body>
    </html>
  );
}
