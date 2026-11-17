import { describe, expect, it, vi } from 'vitest';
import { fontFaceCss, getThemeInjection, themeStyleProps } from './inject';
import { DEFAULT_THEME, parseTheme } from './model';
import { buildThemeCss } from './css';
import type { PublishedTheme } from './service';

function published(overrides: Partial<PublishedTheme> = {}): PublishedTheme {
  return {
    theme: DEFAULT_THEME,
    css: buildThemeCss(DEFAULT_THEME),
    version: 3,
    logoAssetId: null,
    faviconAssetId: null,
    source: 'published',
    ...overrides,
  };
}

const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), child: vi.fn() };

describe('getThemeInjection', () => {
  it('returns css, theme colour and version for the root layout', async () => {
    const result = await getThemeInjection({ getPublished: async () => published() }, { logger });
    expect(result.css).toContain('--color-primary: #1F6FB5;');
    expect(result.themeColor).toBe('#1F6FB5');
    expect(result.version).toBe(3);
    expect(result.fontKey).toBe('inter');
  });

  it('never throws, falls back to the default css instead', async () => {
    const result = await getThemeInjection(
      {
        getPublished: async () => {
          throw new Error('boom');
        },
      },
      { logger },
    );
    expect(result.css).toBe(buildThemeCss(DEFAULT_THEME));
    expect(result.source).toBe('default');
    expect(logger.error).toHaveBeenCalled();
  });

  it('rejects css that could break out of the style element', async () => {
    const result = await getThemeInjection(
      { getPublished: async () => published({ css: ':root{}</style><script>alert(1)</script>' }) },
      { logger },
    );
    expect(result.css).not.toContain('<');
    expect(result.css).toBe(buildThemeCss(DEFAULT_THEME));
  });

  it('adds the self hosted font face for the chosen family only', async () => {
    const theme = parseTheme({ fontKey: 'poppins' });
    const result = await getThemeInjection(
      { getPublished: async () => published({ theme, css: buildThemeCss(theme) }) },
      { logger, fontBaseUrl: '/fonts' },
    );
    expect(result.css).toContain('@font-face');
    expect(result.css).toContain('font-family: "Poppins"');
    expect(result.css).toContain('font-display: swap');
    expect(result.css).not.toContain('"Nunito"; src');
  });

  it('omits font faces without a base url', async () => {
    const result = await getThemeInjection({ getPublished: async () => published() }, { logger });
    expect(result.css).not.toContain('@font-face');
  });
});

describe('themeStyleProps', () => {
  it('produces props for a style element with the request nonce', () => {
    const props = themeStyleProps({ css: ':root{}' }, 'abc123');
    expect(props).toEqual({
      id: 'theme',
      nonce: 'abc123',
      dangerouslySetInnerHTML: { __html: ':root{}' },
    });
  });

  it('omits the nonce when none is given', () => {
    expect('nonce' in themeStyleProps({ css: 'x' })).toBe(false);
  });
});

describe('fontFaceCss', () => {
  it.each(['inter', 'dm-sans', 'poppins', 'nunito', 'lora'] as const)(
    'builds a face for %s',
    (key) => {
      const css = fontFaceCss(key, '/fonts');
      expect(css).toContain('format("woff2")');
      expect(css).toContain(`/fonts/${key}.woff2`);
      expect(css).toContain('font-weight: 400 700');
    },
  );

  it('strips a trailing slash and refuses unsafe base urls', () => {
    expect(fontFaceCss('inter', '/fonts/')).toContain('url("/fonts/inter.woff2")');
    expect(() => fontFaceCss('inter', '/fonts"); } body { x: url("')).toThrow();
  });
});
