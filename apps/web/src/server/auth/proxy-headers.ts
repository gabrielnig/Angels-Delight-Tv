import { buildSecurityHeaders } from '@ad/security';

const PRIVATE_PREFIXES = [
  '/account',
  '/admin',
  '/sign-in',
  '/sign-up',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
];

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export interface ProxyHeaderInput {
  pathname: string;
  nonce: string;
  requestId: string;
  mediaOrigin: string;
  s3Endpoint?: string;
  /** Originals bucket name. With virtual hosted style URLs the browser PUT goes to `<bucket>.<endpoint host>`. */
  s3Bucket?: string;
  isDevelopment: boolean;
  reportOnly: boolean;
  turnstile: boolean;
}

export function proxyResponseHeaders(input: ProxyHeaderInput): Record<string, string> {
  const admin = input.pathname === '/admin' || input.pathname.startsWith('/admin/');
  const uploadOrigin: string[] = [];
  if (input.s3Endpoint) {
    try {
      const endpoint = new URL(input.s3Endpoint);
      uploadOrigin.push(endpoint.origin);
      if (input.s3Bucket) {
        uploadOrigin.push(`${endpoint.protocol}//${input.s3Bucket}.${endpoint.host}`);
      }
    } catch {
      uploadOrigin.length = 0;
    }
  }
  const headers = buildSecurityHeaders({
    nonce: input.nonce,
    mediaOrigin: input.mediaOrigin,
    uploadOrigin,
    admin,
    isDevelopment: input.isDevelopment,
    turnstile: input.turnstile,
    reportOnly: input.reportOnly,
  });
  headers['X-Request-Id'] = input.requestId;
  if (isPrivatePath(input.pathname)) headers['Cache-Control'] = 'private, no-store';
  return headers;
}
