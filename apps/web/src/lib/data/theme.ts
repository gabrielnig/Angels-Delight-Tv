import { DEFAULT_THEME, buildThemeCss, getThemeInjection, type PublishedTheme } from '@ad/theme';
import { createLogger } from '@ad/shared';

/**
 * Theme source for the root layout. Today it returns the default theme from @ad/theme.
 * The integration pass passes the real ThemeService (lane H) into the same getThemeInjection call.
 */
const fixtureThemeService = {
  async getPublished(): Promise<PublishedTheme> {
    return {
      theme: DEFAULT_THEME,
      css: buildThemeCss(DEFAULT_THEME),
      version: null,
      logoAssetId: null,
      faviconAssetId: null,
      source: 'default',
    };
  },
};

const logger = createLogger({ bindings: { module: 'web.theme' } });

export function getThemeForLayout() {
  // No fontBaseUrl: next/font supplies the @font-face rules (see lib/fonts.ts).
  return getThemeInjection(fixtureThemeService, { logger });
}
