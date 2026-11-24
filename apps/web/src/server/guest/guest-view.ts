import 'server-only';
import { cookies } from 'next/headers';
import { themeRuntime } from '../../lib/data/admin/theme-runtime';
import { realAuthEnabled } from '../auth/mode';
import { authRuntime } from '../auth/runtime';
import { guestAudienceCookieName, resolveGuestAudience } from './guest-audience';

/** The cookie names follow the real cookie security setting. Fixture mode has no auth runtime and uses plain names. */
export function guestCookiesSecure(): boolean {
  return realAuthEnabled() ? authRuntime().secureCookies : false;
}

/**
 * The audience this guest sees on a page render: the device choice, else the site default
 * `features.guest_audience` (M40-S09). Named for the data layer (`adult` or `kids`).
 */
export async function currentGuestAudience(): Promise<'adult' | 'kids'> {
  const choice = (await cookies()).get(guestAudienceCookieName(guestCookiesSecure()))?.value;
  const siteDefault = (await themeRuntime()).settings.get('features.guest_audience');
  return resolveGuestAudience(choice, await siteDefault) === 'kids' ? 'kids' : 'adult';
}
