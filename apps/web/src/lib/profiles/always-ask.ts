/**
 * "Always ask who is watching" (M03-S11). A device setting kept in a cookie, so a shared family tablet can ask
 * every time and a personal phone does not. Account settings only flips it. Sign in honours it by forgetting the
 * remembered profile.
 */
export const ALWAYS_ASK_COOKIE = 'ad_always_ask';
export const ALWAYS_ASK_MAX_AGE = 60 * 60 * 24 * 365;

export function alwaysAskFromCookie(value: string | undefined): boolean {
  return value === '1';
}

/** A single profile account skips the picker, unless the setting is on or the viewer chose Switch profile. */
export function pickerAutoSkip(input: { alwaysAsk: boolean; switching: boolean }): boolean {
  return !input.alwaysAsk && !input.switching;
}

/** The remembered profile, or null when it was deleted or nothing is remembered, which shows the picker. */
export function rememberedProfile<P extends { id: string }>(
  profiles: P[],
  rememberedId: string | null | undefined,
): P | null {
  if (!rememberedId) return null;
  return profiles.find((p) => p.id === rememberedId) ?? null;
}
