import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import '@ad/ui/tokens.css';
import '@ad/ui/components.css';
import './globals.css';
import { themeStyleProps } from '@ad/theme';
import { WebVitals } from '../components/observability/WebVitals';
import { PwaClient } from '../components/pwa/PwaClient';
import { getSite } from '../lib/data';
import { getThemeForLayout } from '../lib/data/theme';
import { getPwaSettings } from '../lib/data/pwa-settings';
import { selectFonts } from '../lib/fonts';
import { Providers } from './providers';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite().content();
  return {
    title: { default: site.platformName, template: `%s | ${site.platformName}` },
    description: 'Free learning videos for everyone.',
    icons: { apple: '/icons/apple-touch-icon.png' },
    appleWebApp: { capable: true, title: site.platformName, statusBarStyle: 'default' },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await getThemeForLayout();
  return { themeColor: theme.themeColor, width: 'device-width', initialScale: 1 };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [theme, pwa] = await Promise.all([getThemeForLayout(), getPwaSettings()]);
  const fonts = selectFonts(theme.fontKey);
  return (
    <html lang="en" className={fonts.classNames} style={fonts.variables as CSSProperties}>
      <head>
        <style {...themeStyleProps(theme)} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <PwaClient platformName={pwa.name} />
        <WebVitals />
      </body>
    </html>
  );
}
