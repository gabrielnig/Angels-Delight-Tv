export const OFFLINE_URL = '/offline';
export const SW_URL = '/sw.js';

/** Fetched on install so the offline page works with no network. Keep this list short. */
export const SW_PRECACHE = [OFFLINE_URL, '/manifest.webmanifest', '/brand-icons/icon-192.png'];

/** Public pages kept for the offline screen (M25-S04, D-143). */
export const SW_SAVED_PAGES = ['/about', '/help', '/terms', '/privacy'];
