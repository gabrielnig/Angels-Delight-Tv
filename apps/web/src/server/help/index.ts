import 'server-only';
import { getLibrary } from '@ad/help/node';
import type { HelpRole } from '@ad/help';
import type { AccountRole } from '@ad/shared';
import { themeRuntime } from '@/lib/data/admin/theme-runtime';

export { getLibrary };

/** The staff role as the help centre words it. A viewer never reaches /admin, and counts as Editor if it did. */
export function helpRole(role: AccountRole): HelpRole {
  return role === 'super_admin' ? 'super_admin' : role === 'admin' ? 'admin' : 'editor';
}

/** The setting help.support_contact, or an empty string. Never throws, so the help pages always load (M50-S29). */
export async function supportContactSetting(): Promise<string> {
  try {
    return String((await (await themeRuntime()).settings.get('help.support_contact')) ?? '');
  } catch {
    return '';
  }
}

/** True for the `?show=all` choice on the help home and path pages. */
export const wantsAll = (value: string | string[] | undefined): boolean =>
  (Array.isArray(value) ? value[0] : value) === 'all';
