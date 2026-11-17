import { createHmac } from 'node:crypto';
import type { DeviceClass } from './events';

/** Domain separated key for analytics hashing, derived from an existing secret so no new variable is needed. */
export function deriveAnalyticsSecret(source: Uint8Array): Uint8Array {
  return new Uint8Array(createHmac('sha256', source).update('ad:analytics:v1').digest());
}

/**
 * Anonymous viewer id for unique counts. The Lagos day is part of the input, so the id changes every day and
 * cannot link one profile's activity across days (M19-S07). Truncated to 96 bits, enough to avoid collisions.
 */
export function viewerHash(secret: Uint8Array, day: string, profileId: string): string {
  return createHmac('sha256', secret).update(`${day}|${profileId}`).digest('hex').slice(0, 24);
}

const BOT_PATTERN =
  /bot|crawl|spider|slurp|headless|phantom|curl\/|wget|python-requests|httpclient|lighthouse|pingdom|uptime|monitor|facebookexternalhit|preview/i;

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim().length < 8) return true;
  return BOT_PATTERN.test(userAgent);
}

/** Coarse device class from the user agent, used when the client does not report one. */
export function classifyDevice(userAgent: string | null | undefined): DeviceClass {
  if (!userAgent) return 'other';
  if (/smart-?tv|tizen|webos|hbbtv|appletv|crkey|bravia|roku|fire ?tv/i.test(userAgent))
    return 'tv';
  if (/ipad|tablet/i.test(userAgent)) return 'tablet';
  if (/android/i.test(userAgent)) return /mobile/i.test(userAgent) ? 'phone' : 'tablet';
  if (/iphone|ipod|mobile/i.test(userAgent)) return 'phone';
  if (/windows|macintosh|x11|linux|cros/i.test(userAgent)) return 'desktop';
  return 'other';
}
