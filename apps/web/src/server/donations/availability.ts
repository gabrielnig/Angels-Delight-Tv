import 'server-only';
import { themeRuntime } from '../../lib/data/admin/theme-runtime';
import { donateProvider, readDonateConfig } from './runtime';

/** Donations exist only when the switch is on and the server holds both Paystack secrets. Any error means off. */
export async function donateAvailable(): Promise<boolean> {
  try {
    return donateProvider() !== null && (await readDonateConfig()).enabled;
  } catch {
    return false;
  }
}

/** The public transparency setting alone, for the sitemap. Any error means off. */
export async function transparencyAvailable(): Promise<boolean> {
  try {
    return await (await themeRuntime()).settings.get('donate.transparency.enabled');
  } catch {
    return false;
  }
}
