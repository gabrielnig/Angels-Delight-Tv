import 'server-only';
import { getThemeInjection, themeStyleProps, type ThemeInjection } from '@ad/theme';
import { themeRuntime } from '../data/admin/theme-runtime';

export interface RootTheme {
  injection: ThemeInjection;
  styleProps: ReturnType<typeof themeStyleProps>;
  platformName: string;
}

/**
 * For the root layout. Never throws: falls back to the default theme and name.
 * Usage: const t = await getRootTheme(nonce); <style {...t.styleProps} />
 * and viewport.themeColor = t.injection.themeColor.
 */
export async function getRootTheme(nonce?: string): Promise<RootTheme> {
  const rt = await themeRuntime();
  const injection = await getThemeInjection(rt.theme, { logger: rt.logger });
  let platformName = 'Angels Delight TV';
  try {
    platformName = String(await rt.settings.get('platform.name'));
  } catch {
    /* keep default */
  }
  return { injection, styleProps: themeStyleProps(injection, nonce), platformName };
}
