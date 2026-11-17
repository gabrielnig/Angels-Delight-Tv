export interface TurnstileKeys {
  siteKey: string;
  secretKey: string;
}

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_TOKEN = 2048;
const TIMEOUT_MS = 5000;

/** Turnstile is on only when both keys are set. Without them every form works as before (SECURITY.md section 4). */
export function turnstileFromEnv(env: {
  TURNSTILE_SITE_KEY?: string | undefined;
  TURNSTILE_SECRET_KEY?: string | undefined;
}): TurnstileKeys | null {
  const siteKey = env.TURNSTILE_SITE_KEY?.trim();
  const secretKey = env.TURNSTILE_SECRET_KEY?.trim();
  return siteKey && secretKey ? { siteKey, secretKey } : null;
}

/**
 * Checks a widget token with Cloudflare. Fails closed: a missing token, a bad answer or an unreachable
 * service all count as not verified, so the person is asked to try again rather than waved through.
 */
export async function verifyTurnstile(
  keys: TurnstileKeys,
  token: string | undefined,
  ip: string | null,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!token || token.length > MAX_TOKEN) return false;
  const body = new URLSearchParams({ secret: keys.secretKey, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const response = await fetcher(VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: unknown };
    return result.success === true;
  } catch {
    return false;
  }
}
