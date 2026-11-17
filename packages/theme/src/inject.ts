import type { Logger } from '@ad/shared';
import type { FontKey } from '@ad/ui';
import { buildThemeCss } from './css';
import { FONT_OPTIONS, DEFAULT_THEME } from './model';
import type { PublishedTheme } from './service';

export interface ThemeInjection {
  /** Contents of the `<style id="theme">` element. Never contains `<` or `>`. */
  css: string;
  /** For the viewport `themeColor` and the web manifest. */
  themeColor: string;
  fontKey: FontKey;
  version: number | null;
  logoAssetId: string | null;
  faviconAssetId: string | null;
  source: 'published' | 'default';
}

export interface InjectionOptions {
  logger: Logger;
  /** Where the self hosted WOFF2 files are served from, for example `/fonts`. Omit to skip `@font-face`. */
  fontBaseUrl?: string;
}

const SAFE_BASE_URL =
  /^(\/[A-Za-z0-9._~-]+)*\/?$|^https:\/\/[A-Za-z0-9.-]+(\/[A-Za-z0-9._~-]+)*\/?$/;

/** One variable font file per family, subset to Latin and Latin Extended (D-007, DESIGN-SYSTEM 5.1). */
export function fontFaceCss(fontKey: FontKey, baseUrl: string): string {
  if (!SAFE_BASE_URL.test(baseUrl)) throw new Error('Unsafe font base url');
  const option = FONT_OPTIONS.find((font) => font.key === fontKey);
  if (!option) throw new Error('Unknown font');
  const base = baseUrl.replace(/\/$/, '');
  return [
    '@font-face {',
    `  font-family: "${option.label}";`,
    `  src: url("${base}/${fontKey}.woff2") format("woff2");`,
    '  font-weight: 400 700;',
    '  font-style: normal;',
    '  font-display: swap;',
    '}',
    '',
  ].join('\n');
}

function safeCss(css: string): boolean {
  return !/[<>]/.test(css);
}

/**
 * The one call the root layout makes. It never throws: if the theme service fails or returns unsafe css the
 * default theme is rendered, so a broken theme can never break a page (M18-S07 AC3).
 */
export async function getThemeInjection(
  service: { getPublished(): Promise<PublishedTheme> },
  options: InjectionOptions,
): Promise<ThemeInjection> {
  let value: PublishedTheme;
  try {
    value = await service.getPublished();
    if (!safeCss(value.css)) throw new Error('theme css contains markup characters');
  } catch (error) {
    options.logger.error('theme injection failed, rendering the default theme', { error });
    value = {
      theme: DEFAULT_THEME,
      css: buildThemeCss(DEFAULT_THEME),
      version: null,
      logoAssetId: null,
      faviconAssetId: null,
      source: 'default',
    };
  }
  let css = value.css;
  if (options.fontBaseUrl) {
    try {
      css = fontFaceCss(value.theme.fontKey, options.fontBaseUrl) + css;
    } catch (error) {
      options.logger.error('font face skipped', { error });
    }
  }
  return {
    css,
    themeColor: value.theme.colors.primary,
    fontKey: value.theme.fontKey,
    version: value.version,
    logoAssetId: value.logoAssetId,
    faviconAssetId: value.faviconAssetId,
    source: value.source,
  };
}

/** Props for `<style {...themeStyleProps(injection, nonce)} />` in the root layout. */
export function themeStyleProps(
  injection: Pick<ThemeInjection, 'css'>,
  nonce?: string,
): { id: 'theme'; nonce?: string; dangerouslySetInnerHTML: { __html: string } } {
  return {
    id: 'theme',
    ...(nonce ? { nonce } : {}),
    dangerouslySetInnerHTML: { __html: injection.css },
  };
}
