const FALLBACK = '/profiles';
const AUTH_SCREENS = [
  '/sign-in',
  '/sign-up',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
];

/** Post sign-in redirect target: same-origin relative paths only, never an auth screen or the admin area. */
export function safeViewerNext(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) return FALLBACK;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return FALLBACK;
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code === 127) return FALLBACK;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return FALLBACK;
  }
  if (decoded.startsWith('//') || decoded.includes('\\') || /\/\.\.?(\/|$)/.test(decoded))
    return FALLBACK;
  const path = value.split(/[?#]/)[0] ?? '';
  if (path === '/admin' || path.startsWith('/admin/')) return FALLBACK;
  if (AUTH_SCREENS.some((screen) => path === screen || path.startsWith(`${screen}/`)))
    return FALLBACK;
  return value;
}
