import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { CSSProperties, ReactNode } from 'react';
import '@ad/ui/tokens.css';
import '@ad/ui/components.css';
import './globals.css';
import { StorageNotice } from '../components/consent/StorageNotice';
import { WebVitals } from '../components/observability/WebVitals';
import { PwaClient } from '../components/pwa/PwaClient';
import { selectFonts } from '../lib/fonts';
import { CLIENT_NAMESPACES, pickNamespaces } from '../lib/i18n/namespaces';
import { I18nProvider } from '../lib/i18n/provider';
import { getLocale, loadCatalog } from '../lib/i18n/server';
import { getRootTheme } from '../lib/theme/root';
import { getSeoSettings } from '../server/seo/seo-settings';
import { localeInfo } from '@ad/shared/messages';
import { Providers } from './providers';

export async function generateMetadata(): Promise<Metadata> {
  const [{ platformName }, seo] = await Promise.all([getRootTheme(), getSeoSettings()]);
  const origin = process.env.APP_ORIGIN;
  return {
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    title: { default: platformName, template: `%s | ${platformName}` },
    description: seo.description,
    ...(seo.indexing ? {} : { robots: { index: false, follow: false } }),
    icons: {
      icon: [{ url: '/brand-icons/favicon-32.png', sizes: '32x32', type: 'image/png' }],
      apple: '/brand-icons/apple-touch-icon.png',
    },
    openGraph: {
      siteName: platformName,
      description: seo.description,
      images: [seo.socialImageUrl],
    },
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
  const locale = await getLocale();
  const catalog = pickNamespaces(await loadCatalog(locale), CLIENT_NAMESPACES, { production: true });
  const seo = await getSeoSettings();
  const fonts = selectFonts(theme.injection.fontKey, locale);
  return (
    <html
      lang={localeInfo(locale)?.htmlLang ?? 'en-NG'}
      className={fonts.classNames}
      style={fonts.variables as CSSProperties}
    >
      <head>
        <style {...theme.styleProps} />
      </head>
      <body>
        <I18nProvider locale={locale} catalog={catalog}>
          <Providers>{children}</Providers>
        </I18nProvider>
        <StorageNotice enabled={seo.noticeEnabled} text={seo.noticeText} version={seo.noticeVersion} />
        <PwaClient platformName={theme.platformName} />
        <WebVitals />
      </body>
    </html>
  );
}
