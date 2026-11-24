import 'server-only';
import { LOCALES } from '@ad/shared/messages';
import { themeRuntime } from '../data/admin/theme-runtime';
import { getLocale } from './server';

/** Locales for the picker, or null when fewer than two are enabled (the picker draws nothing then). */
export async function pickerData() {
  const enabled: string[] = await (await themeRuntime()).settings.get('content.ui_languages');
  const locales = LOCALES.filter((l) => enabled.includes(l.code)).map((l) => ({
    code: l.code,
    endonym: l.endonym,
    englishName: l.englishName,
    htmlLang: l.htmlLang,
  }));
  if (locales.length < 2) return null;
  const current = await getLocale();
  return { locales, current, incomplete: current !== 'en' };
}
