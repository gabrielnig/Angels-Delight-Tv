import { Forbidden } from '@ad/shared';

/**
 * CSRF defence for state changing handlers (SECURITY.md section 4). A browser always sends Origin on
 * cross-origin POSTs. When Origin is missing, Sec-Fetch-Site must say same-origin. Anything else is refused.
 */
export function assertSameOrigin(headers: Headers, appOrigin: string): void {
  const expected = new URL(appOrigin).origin;
  const origin = headers.get('origin');
  if (origin !== null) {
    if (origin === expected) return;
    throw new Forbidden('Cross-origin request refused');
  }
  if (headers.get('sec-fetch-site') === 'same-origin') return;
  throw new Forbidden('Cross-origin request refused');
}
