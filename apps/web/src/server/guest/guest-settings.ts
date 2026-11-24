import 'server-only';
import { themeRuntime } from '../../lib/data/admin/theme-runtime';

/** The emergency switch `features.guest_play` (D-G9). Read through the settings cache and its safe default. */
export async function guestPlayEnabled(): Promise<boolean> {
  return (await themeRuntime()).settings.get('features.guest_play');
}
