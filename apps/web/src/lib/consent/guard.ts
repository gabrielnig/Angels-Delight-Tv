/**
 * The consent guard (M45-S12, D-L6-3). Everything the site keeps is necessary or functional, and analytics is first
 * party and anonymous, so there is nothing to ask a visitor to accept. Anything identified or for marketing must go
 * through `canUse`, which says no. Adding such a thing means logging a decision, changing this file and building a
 * real choice banner first, and the posture tests fail until then.
 */
export type StorageCategory = 'necessary' | 'functional' | 'analytics-identified' | 'marketing';

const ALLOWED: ReadonlySet<string> = new Set(['necessary', 'functional']);

export function canUse(category: StorageCategory): boolean {
  return ALLOWED.has(category);
}

/** Events that describe what a person looked for or shared. They are skipped when a privacy signal is on. */
export const OPTIONAL_EVENT_KINDS = ['search', 'share'] as const;

export interface PrivacySignals {
  globalPrivacyControl?: boolean;
  doNotTrack?: string | null;
}

/** Global Privacy Control, or Do Not Track set to yes. */
export function privacySignalOn(nav: PrivacySignals | undefined): boolean {
  if (!nav) return false;
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1' || nav.doNotTrack === 'yes';
}

/** Playback health and errors are operational and always allowed. */
export function allowEvent(kind: string, nav: PrivacySignals | undefined): boolean {
  if ((OPTIONAL_EVENT_KINDS as readonly string[]).includes(kind)) return !privacySignalOn(nav);
  return true;
}
