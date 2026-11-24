import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRootTheme = vi.fn();
const seo = vi.hoisted(() => ({
  value: {
    description: 'Free learning videos for everyone.',
    socialImageUrl: '/brand-icons/placeholder-og.png',
    indexing: true,
    noticeEnabled: true,
    noticeText: 'We keep a few small files on your device.',
    noticeVersion: 2,
    supportEmail: 'help@example.org',
  },
}));
vi.mock('../server/seo/seo-settings', () => ({ getSeoSettings: async () => seo.value }));
vi.mock('../lib/theme/root', () => ({ getRootTheme: (nonce?: string) => getRootTheme(nonce) }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-nonce': 'abc123' }),
  cookies: async () => ({ get: () => undefined }),
}));
// The language lookup reads the theme runtime and the session, which need a database. The layout test pins markup.
vi.mock('../lib/i18n/server', () => ({
  getLocale: async () => 'en',
  loadCatalog: async () => ({ nav: {} }),
}));
vi.mock('../components/account/AccountSupport', () => ({
  AccountSupportProvider: ({ email, children }: { email: string; children: React.ReactNode }) => (
    <div data-testid="support" data-email={email}>
      {children}
    </div>
  ),
}));
vi.mock('../components/consent/StorageNotice', () => ({
  StorageNotice: (props: { enabled: boolean; text: string; version: number }) => (
    <i data-testid="notice" data-enabled={String(props.enabled)} data-version={props.version}>
      {props.text}
    </i>
  ),
}));
vi.mock('../lib/fonts', () => ({
  selectFonts: (key: string) => ({ classNames: `font-${key}`, variables: {} }),
}));
vi.mock('./providers', () => ({
  Providers: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../components/pwa/PwaClient', () => ({
  PwaClient: ({ platformName }: { platformName: string }) => (
    <i data-testid="pwa">{platformName}</i>
  ),
}));
vi.mock('../components/observability/WebVitals', () => ({
  WebVitals: () => <i data-testid="vitals" />,
}));
vi.mock('@ad/ui/tokens.css', () => ({}));
vi.mock('@ad/ui/components.css', () => ({}));
vi.mock('./globals.css', () => ({}));

import RootLayout, { generateMetadata, generateViewport } from './layout';

const theme = {
  injection: { css: ':root{--color-primary:#123456}', themeColor: '#123456', fontKey: 'nunito' },
  styleProps: {
    id: 'theme',
    nonce: 'abc123',
    dangerouslySetInnerHTML: { __html: ':root{--color-primary:#123456}' },
  },
  platformName: 'Sister V TV',
};

describe('root layout', () => {
  beforeEach(() => {
    getRootTheme.mockReset();
    getRootTheme.mockResolvedValue(theme);
    seo.value = {
      description: 'Free learning videos for everyone.',
      socialImageUrl: '/brand-icons/placeholder-og.png',
      indexing: true,
      noticeEnabled: true,
      noticeText: 'We keep a few small files on your device.',
      noticeVersion: 2,
      supportEmail: 'help@example.org',
    };
  });

  it('injects the published theme with the request nonce and keeps the PWA client and web vitals', async () => {
    const html = renderToStaticMarkup(await RootLayout({ children: <main>Page</main> }));
    expect(getRootTheme).toHaveBeenCalledWith('abc123');
    expect(html).toContain(
      '<style id="theme" nonce="abc123">:root{--color-primary:#123456}</style>',
    );
    expect(html).toContain('class="font-nunito"');
    expect(html).toContain('<main>Page</main>');
    expect(html).toContain('data-testid="pwa"');
    expect(html).toContain('data-testid="vitals"');
  });

  it('gives error pages the configured support email', async () => {
    const html = renderToStaticMarkup(await RootLayout({ children: <main>Page</main> }));
    expect(html).toContain('data-email="help@example.org"');
  });

  it('mounts the storage notice once with the configured text and version (M45-S11)', async () => {
    const html = renderToStaticMarkup(await RootLayout({ children: <main>Page</main> }));
    expect(html.match(/data-testid="notice"/g)).toHaveLength(1);
    expect(html).toContain('We keep a few small files on your device.');
    expect(html).toContain('data-version="2"');
  });

  it('takes the viewport colour and the site name from the theme runtime', async () => {
    expect((await generateViewport()).themeColor).toBe('#123456');
    const metadata = await generateMetadata();
    expect(metadata.icons).toMatchObject({ icon: [{ url: '/brand-icons/favicon-32.png' }] });
    expect(metadata.openGraph?.images).toEqual(['/brand-icons/placeholder-og.png']);
    expect(metadata.title).toEqual({ default: 'Sister V TV', template: '%s | Sister V TV' });
  });

  it('uses the configured description and social image for every page (M45-S05)', async () => {
    seo.value = {
      description: 'Lessons for every family',
      socialImageUrl: 'https://cdn.test/og.jpg',
      indexing: true,
      noticeEnabled: true,
      noticeText: '',
      noticeVersion: 1,
      supportEmail: '',
    };
    const metadata = await generateMetadata();
    expect(metadata.description).toBe('Lessons for every family');
    expect(metadata.openGraph?.images).toEqual(['https://cdn.test/og.jpg']);
    expect(metadata.openGraph?.description).toBe('Lessons for every family');
    expect(metadata.robots).toBeUndefined();
  });

  it('asks for noindex on every page when indexing is off', async () => {
    seo.value = { ...seo.value, indexing: false };
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: false });
  });
});
