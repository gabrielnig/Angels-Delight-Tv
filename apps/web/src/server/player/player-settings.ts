import 'server-only';
import { clampCountdown } from '@ad/player';
import { themeRuntime } from '../../lib/data/admin/theme-runtime';

/** `playback.countdown_seconds` (M29, L4-D4): how long the next video waits. A failed read means the default 5. */
export async function playerCountdownSeconds(): Promise<number> {
  try {
    const { settings } = await themeRuntime();
    return clampCountdown(await settings.get('playback.countdown_seconds'));
  } catch {
    return clampCountdown(undefined);
  }
}
