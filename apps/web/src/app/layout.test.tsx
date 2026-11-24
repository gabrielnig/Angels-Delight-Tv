import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRootTheme = vi.fn();
const seo = vi.hoisted(() => ({
  value: {
    description: 'Free learning videos for everyone.',
    socialImageUrl: '/brand-icons/placeholder-og.png',
    indexing: true,
  },
}));
vi.mock('../server/seo/seo-settings', () => ({ getSeoSettings: async () => seo.value }));
vi.mock('../lib/theme/root', () => ({ getRootTheme: (nonce?: string) => getRootTheme(nonce) }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-nonce': 'abc123' }),
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
