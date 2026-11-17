export const OFFLINE_URL = '/offline';
export const SW_URL = '/sw.js';

/** Fetched on install so the offline page works with no network. Keep this list short. */
export const SW_PRECACHE = [OFFLINE_URL, '/manifest.webmanifest', '/icons/icon-192.png'];
