import { THEME_PRESETS, type ThemeService } from '@ad/theme';

/**
 * The demo stack starts with two published themes in the history, so the help articles about going back to an
 * earlier theme have something to restore. It only runs when KB_DEMO is on (see theme-runtime.ts).
 */
export async function seedDemoThemeHistory(theme: ThemeService): Promise<void> {
  const actor = { accountId: 'acc_demo_admin', role: 'admin' as const, name: 'Demo Admin' };
  for (const key of ['turquoise', 'sunny-yellow']) {
    const preset = THEME_PRESETS.find((p) => p.key === key);
    if (!preset) continue;
    await theme.saveDraft(actor, preset.theme);
    await theme.publish(actor, { acknowledgeWarnings: true });
  }
}
