import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const selectFonts = vi.fn(() => ({ classNames: '', variables: {} }));
vi.mock('../fonts', () => ({ selectFonts }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('../theme/root', () => ({
  getRootTheme: async () => ({
    platformName: 'X',
    injection: { fontKey: 'inter', themeColor: '#fff' },
    styleProps: {},
  }),
}));
vi.mock('./server', () => ({
  getLocale: async () => 'yo',
  getTranslator: async () => (k: string) => k,
  loadCatalog: async () => ({}),
}));
vi.mock('../../app/providers', () => ({ Providers: ({ children }: { children: unknown }) => children }));
vi.mock('../../components/observability/WebVitals', () => ({ WebVitals: () => null }));
vi.mock('../../components/pwa/PwaClient', () => ({ PwaClient: () => null }));
vi.mock('@ad/ui/tokens.css', () => ({}));
vi.mock('@ad/ui/components.css', () => ({}));
vi.mock('../../app/globals.css', () => ({}));

describe('root layout lang', () => {
  it('html lang follows the resolved locale', async () => {
    const { default: RootLayout } = await import('../../app/layout');
    const html = renderToStaticMarkup(await RootLayout({ children: null }));
    expect(html).toMatch(/<html lang="yo"/);
    expect(selectFonts).toHaveBeenCalledWith('inter', 'yo');
  });
});
