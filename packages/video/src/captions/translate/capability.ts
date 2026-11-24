import type { TranslationCapability } from '../service';

const GOOGLE_LANGUAGES = ['en', 'yo', 'ig', 'ha'];
/** Published list price per million characters, for the admin estimate only. Check it before relying on it. */
const GOOGLE_USD_PER_MILLION = 20;

/**
 * What the web process may say about the engine the worker runs, from TRANSLATE_PROVIDER alone. The web
 * never holds the API key. Undefined means no engine, so the admin offers no translation.
 */
export function translationCapability(provider: 'none' | 'google' | 'fake'): TranslationCapability | undefined {
  if (provider === 'google') {
    return {
      name: 'google',
      supports: (s, t) => GOOGLE_LANGUAGES.includes(s) && GOOGLE_LANGUAGES.includes(t),
      usdPerMillionChars: GOOGLE_USD_PER_MILLION,
    };
  }
  if (provider === 'fake') return { name: 'fake', supports: () => true, usdPerMillionChars: null };
  return undefined;
}
