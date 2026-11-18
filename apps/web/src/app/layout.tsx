import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { CSSProperties, ReactNode } from 'react';
import '@ad/ui/tokens.css';
import '@ad/ui/components.css';
import './globals.css';
import { WebVitals } from '../components/observability/WebVitals';
import { PwaClient } from '../components/pwa/PwaClient';
import { selectFonts } from '../lib/fonts';
import { getRootTheme } from '../lib/theme/root';
import { Providers } from './providers';

export async function generateMetadata(): Promise<Metadata> {
  const { platformName } = await getRootTheme();
  const origin = process.env.APP_ORIGIN;
  return {
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    title: { default: platformName, template: `%s | ${platformName}` },
    description: 'Free learning videos for everyone.',
    icons: {
      icon: [{ url: '/brand-icons/favicon-32.png', sizes: '32x32', type: 'image/png' }],
      apple: '/brand-icons/apple-touch-icon.png',
    },
    openGraph: { siteName: platformName, images: ['/brand-icons/placeholder-og.png'] },
    appleWebApp: { capable: true, title: platformName, statusBarStyle: 'default' },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { injection } = await getRootTheme();
  return { themeColor: injection.themeColor, width: 'device-width', initialScale: 1 };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const theme = await getRootTheme(nonce);
  const fonts = selectFonts(theme.injection.fontKey);
  return (
    <html lang="en" className={fonts.classNames} style={fonts.variables as CSSProperties}>
      <head>
        <style {...theme.styleProps} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <PwaClient platformName={theme.platformName} />
        <WebVitals />
      </body>
    </html>
  );
}
