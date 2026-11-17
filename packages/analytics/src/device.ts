import type { DeviceClass } from './constants';

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
