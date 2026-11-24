import type { GoogleConfig } from '@ad/auth';

interface GoogleEnv {
  APP_ORIGIN: string;
  GOOGLE_CLIENT_ID?: string | undefined;
  GOOGLE_CLIENT_SECRET?: string | undefined;
}

/** The OAuth client settings, or null when the keys are not both set (the feature is then absent). */
export function googleConfigFrom(env: GoogleEnv): GoogleConfig | null {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${env.APP_ORIGIN.replace(/\/+$/, '')}/api/auth/google/callback`,
  };
}

/**
 * Both keys are set and the `features.signin_with_google` site setting is on. With no keys the setting is not
 * read at all. A failed read counts as off, so a database problem never shows a button that cannot work.
 */
export async function googleEnabled(
  env: GoogleEnv,
  readSetting: () => Promise<unknown>,
): Promise<boolean> {
  if (!googleConfigFrom(env)) return false;
  try {
    return (await readSetting()) === true;
  } catch {
    return false;
  }
}
