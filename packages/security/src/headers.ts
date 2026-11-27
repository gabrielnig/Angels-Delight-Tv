export interface CspOptions {
  nonce: string;
  mediaOrigin: string;
  /** Object storage origin used by the admin uploader. Only added on admin pages. */
  uploadOrigin?: string | readonly string[];
  admin: boolean;
  isDevelopment: boolean;
  /** Origin of the Turnstile challenge frame, when Turnstile is configured. */
  turnstile?: boolean;
}

export interface HeaderOptions extends CspOptions {
  reportOnly?: boolean;
}

/** The nonce based policy from SECURITY.md section 14. */
export function buildCsp(options: CspOptions): string {
  const { nonce, mediaOrigin, uploadOrigin, admin, isDevelopment, turnstile } = options;
  const connect = ["'self'", mediaOrigin];
  if (admin && uploadOrigin) connect.push(...[uploadOrigin].flat());
  const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (isDevelopment) script.push("'unsafe-eval'");
  const directives = [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: blob: ${mediaOrigin}`,
    `media-src 'self' blob: ${mediaOrigin}`,
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    "worker-src 'self' blob:",
    turnstile ? 'frame-src https://challenges.cloudflare.com' : "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'report-uri /api/csp-report',
  ];
  if (!isDevelopment) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export function buildSecurityHeaders(options: HeaderOptions): Record<string, string> {
  const headers: Record<string, string> = {
    [options.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy']:
      buildCsp(options),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
  if (!options.isDevelopment) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  return headers;
}
