import { normalizeLocale, type LocaleCode } from '@ad/shared/messages';

export interface SetLanguageDeps {
  enabled(): Promise<string[]>;
  session(): Promise<{ accountId: string; profileId: string; kids: boolean } | null>;
  setCookie(locale: LocaleCode): void | Promise<void>;
  saveProfile(accountId: string, profileId: string, locale: LocaleCode): Promise<void>;
}

export type SetLanguageResult =
  | { ok: true; locale: LocaleCode }
  | { ok: false; reason: 'unsupported' | 'kids' };

/** Cookie for everyone, plus the profile when signed in. A kids profile keeps the language its grown-up set. */
export async function setLanguage(code: string, deps: SetLanguageDeps): Promise<SetLanguageResult> {
  const locale = normalizeLocale(code);
  if (!locale || !(await deps.enabled()).includes(locale)) return { ok: false, reason: 'unsupported' };
  const session = await deps.session();
  if (session?.kids) return { ok: false, reason: 'kids' };
  await deps.setCookie(locale);
  if (session) await deps.saveProfile(session.accountId, session.profileId, locale);
  return { ok: true, locale };
}
