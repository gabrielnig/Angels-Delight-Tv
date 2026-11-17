import 'server-only';
import { realAuthEnabled } from './mode';
import { turnstileFromEnv } from './turnstile';

/** The public site key for the forms, or undefined when Turnstile is off or auth runs on fixtures. */
export function turnstileSiteKey(): string | undefined {
  if (!realAuthEnabled()) return undefined;
  return turnstileFromEnv({
    TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  })?.siteKey;
}
