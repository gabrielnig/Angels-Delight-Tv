import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { CSSProperties, ReactNode } from 'react';
import '@ad/ui/tokens.css';
import '@ad/ui/components.css';
import './globals.css';
import './tv.css';
import { AccountSupportProvider } from '../components/account/AccountSupport';
import { TvNav } from '../components/tv/TvNav';
import { StorageNotice } from '../components/consent/StorageNotice';
import { WebVitals } from '../components/observability/WebVitals';
import { PwaClient } from '../components/pwa/PwaClient';
import { selectFonts } from '../lib/fonts';
import { CLIENT_NAMESPACES, pickNamespaces } from '../lib/i18n/namespaces';
import { I18nProvider } from '../lib/i18n/provider';
import { getLocale, loadCatalog } from '../lib/i18n/server';
import { tvModeFromHeaders } from '../lib/tv/server';
import { getRootTheme } from '../lib/theme/root';
import { getSeoSettings } from '../server/seo/seo-settings';
import { getSiteMeta } from '../server/seo/site-meta';
import { buildMetadata } from '../lib/seo/metadata';
import { localeInfo } from '@ad/shared/messages';
import { Providers } from './providers';

export async function generateMetadata(): Promise<Metadata> {
  const [{ platformName }, site] = await Promise.all([getRootTheme(), getSiteMeta()]);
  const origin = process.env.APP_ORIGIN;
  const base = buildMetadata(site, { kind: 'website', path: '/' });
  // Pages set their own canonical and og:url. A site wide one would point every page at the home page.
  const { url: _url, ...openGraph } = (base.openGraph ?? {}) as Record<string, unknown>;
  return {
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    title: { default: platformName, template: `%s | ${platformName}` },
    description: base.description,
    ...(base.robots ? { robots: base.robots } : {}),
    icons: {
      icon: [{ url: '/brand-icons/favicon-32.png', sizes: '32x32', type: 'image/png' }],
      apple: '/brand-icons/apple-touch-icon.png',
    },
    openGraph: openGraph as Metadata['openGraph'],
    twitter: base.twitter,
    appleWebApp: { capable: true, title: platformName, statusBarStyle: 'default' },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { injection } = await getRootTheme();
  return { themeColor: injection.themeColor, width: 'device-width', initialScale: 1 };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const nonce = requestHeaders.get('x-nonce') ?? undefined;
  const tv = tvModeFromHeaders(requestHeaders);
  const theme = await getRootTheme(nonce);
  const locale = await getLocale();
  const catalog = pickNamespaces(await loadCatalog(locale), CLIENT_NAMESPACES, {
    production: true,
  });
  const seo = await getSeoSettings();
  const fonts = selectFonts(theme.injection.fontKey, locale);
  return (
    <html
      lang={localeInfo(locale)?.htmlLang ?? 'en-NG'}
      className={fonts.classNames}
      style={fonts.variables as CSSProperties}
      {...(tv ? { 'data-tv': 'on' } : {})}
    >
      <head>
        <style {...theme.styleProps} />
      </head>
      <body>
        <I18nProvider locale={locale} catalog={catalog}>
          <AccountSupportProvider email={seo.supportEmail}>
            <Providers>{children}</Providers>
          </AccountSupportProvider>
        </I18nProvider>
        <StorageNotice
          enabled={seo.noticeEnabled}
          text={seo.noticeText}
          version={seo.noticeVersion}
        />
        <PwaClient platformName={theme.platformName} />
        <WebVitals />
        <TvNav />
      </body>
    </html>
  );
}
