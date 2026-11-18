/** Plain constants shared by the browser client and the server. No imports, so the client bundle stays small. */
export const EVENT_SCHEMA_VERSION = 1;
export const DEVICE_CLASSES = ['phone', 'tablet', 'desktop', 'tv', 'other'] as const;
export type DeviceClass = (typeof DEVICE_CLASSES)[number];
export const VITAL_NAMES = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const;
