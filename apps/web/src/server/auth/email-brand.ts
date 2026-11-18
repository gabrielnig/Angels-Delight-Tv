import { DEFAULT_THEME, LogoUploader } from '@ad/theme';
import type { BrandContext } from '@ad/mailer';
import type { ThemeRuntime } from '../../lib/data/admin/theme-runtime';

const DEFAULT_NAME = 'Angels Delight TV';

/**
 * The site name, logo and published theme colours for the next email. Read per send, so a change published in
 * /admin/theme reaches new emails without a deploy. Never throws: anything unreadable falls back to the defaults.
 */
export async function emailBrandFrom(
  rt: Pick<ThemeRuntime, 'theme' | 'settings' | 'logos' | 'logger'>,
  mediaOrigin: string,
): Promise<Partial<BrandContext>> {
  let appName = DEFAULT_NAME;
  try {
    const name = String(await rt.settings.get('platform.name')).trim();
    if (name) appName = name;
  } catch {
    // keep the default name
  }
  let colors = DEFAULT_THEME.colors;
  let logoUrl: string | undefined;
  try {
    const published = await rt.theme.getPublished();
    colors = published.theme.colors;
    if (published.logoAssetId) {
      const asset = await rt.logos.get(published.logoAssetId);
      if (asset && asset.variants.length > 0) {
        logoUrl = `${mediaOrigin.replace(/\/$/, '')}/${LogoUploader.variantKey(asset, 400)}`;
      }
    }
  } catch (error) {
    rt.logger.warn('email brand read failed, using defaults', { error: String(error) });
  }
  return {
    appName,
    primaryColor: colors.primary,
    backgroundColor: colors.bg,
    surfaceColor: colors.surface,
    inkColor: colors.ink,
    mutedColor: colors.muted,
    logoUrl,
  };
}
