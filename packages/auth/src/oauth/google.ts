import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify } from 'node:crypto';

/**
 * A small Google OpenID Connect client: authorization code flow with PKCE, a `state` and a `nonce`, and a full
 * check of the ID token (signature, issuer, audience, expiry, nonce). It uses `fetch` only, so tests pass a fake
 * provider and no new dependency is needed (decision D-L10-03).
 */
export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  /** `${APP_ORIGIN}/api/auth/google/callback`. */
  redirectUri: string;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  /** True only when Google sent the boolean `true`. A string, a missing claim or false is not verified. */
  emailVerified: boolean;
}

export type GoogleFailure =
  | 'verifier'
  | 'exchange'
  | 'keys'
  | 'token'
  | 'signature'
  | 'issuer'
  | 'audience'
  | 'expired'
  | 'nonce'
  | 'claims';

/** Every failure of the flow. The reason is for logs and tests, the person always sees one generic page. */
export class GoogleOAuthError extends Error {
  constructor(readonly reason: GoogleFailure) {
    super(`Google sign in failed: ${reason}`);
    this.name = 'GoogleOAuthError';
  }
}

export interface OAuthParams {
  state: string;
  nonce: string;
  verifier: string;
  challenge: string;
}

const token = (bytes: number): string => randomBytes(bytes).toString('base64url');

/** Fresh single use values for one sign in attempt. The verifier never leaves the server and the signed cookie. */
export function newOAuthParams(): OAuthParams {
  const verifier = token(48);
  return {
    state: token(24),
    nonce: token(24),
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
  };
}

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const CLOCK_SKEW_SECONDS = 60;
const KEY_CACHE_MS = 10 * 60 * 1000;

type Jwk = { kid?: string; kty?: string; n?: string; e?: string };

export interface GoogleClient {
  authorizationUrl(params: Pick<OAuthParams, 'state' | 'nonce' | 'challenge'>): string;
  exchange(input: { code: string; codeVerifier: string; nonce: string }): Promise<GoogleProfile>;
}

export function createGoogleClient(
  config: GoogleConfig,
  options: { fetch?: typeof fetch; now?: () => number } = {},
): GoogleClient {
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? (() => Date.now());
  let cache: { keys: Jwk[]; at: number } | null = null;

  async function keys(forceRefresh: boolean): Promise<Jwk[]> {
    if (!forceRefresh && cache && now() - cache.at < KEY_CACHE_MS) return cache.keys;
    let response: Response;
    try {
      response = await doFetch(CERTS_URL);
    } catch {
      throw new GoogleOAuthError('keys');
    }
    if (!response.ok) throw new GoogleOAuthError('keys');
    const body = (await response.json().catch(() => null)) as { keys?: Jwk[] } | null;
    if (!body || !Array.isArray(body.keys)) throw new GoogleOAuthError('keys');
    cache = { keys: body.keys, at: now() };
    return cache.keys;
  }

  async function verifySignature(
    header: { kid?: string; alg?: string },
    signed: string,
    sig: Buffer,
  ) {
    if (header.alg !== 'RS256') throw new GoogleOAuthError('signature');
    let published = await keys(false);
    let jwk = published.find((k) => k.kid === header.kid);
    if (!jwk) {
      published = await keys(true);
      jwk = published.find((k) => k.kid === header.kid);
    }
    if (!jwk || jwk.kty !== 'RSA') throw new GoogleOAuthError('signature');
    const ok = verify(
      'RSA-SHA256',
      Buffer.from(signed),
      createPublicKey({ key: jwk as never, format: 'jwk' }),
      sig,
    );
    if (!ok) throw new GoogleOAuthError('signature');
  }

  return {
    authorizationUrl({ state, nonce, challenge }) {
      const url = new URL(AUTH_URL);
      const q = url.searchParams;
      q.set('client_id', config.clientId);
      q.set('redirect_uri', config.redirectUri);
      q.set('response_type', 'code');
      q.set('scope', 'openid email profile');
      q.set('state', state);
      q.set('nonce', nonce);
      q.set('code_challenge', challenge);
      q.set('code_challenge_method', 'S256');
      q.set('prompt', 'select_account');
      return url.toString();
    },

    async exchange({ code, codeVerifier, nonce }) {
      if (!codeVerifier || codeVerifier.length < 43) throw new GoogleOAuthError('verifier');
      let response: Response;
      try {
        response = await doFetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: config.redirectUri,
            grant_type: 'authorization_code',
            code_verifier: codeVerifier,
          }).toString(),
        });
      } catch {
        throw new GoogleOAuthError('exchange');
      }
      if (!response.ok) throw new GoogleOAuthError('exchange');
      const body = (await response.json().catch(() => null)) as { id_token?: unknown } | null;
      if (typeof body?.id_token !== 'string') throw new GoogleOAuthError('token');

      const parts = body.id_token.split('.');
      if (parts.length !== 3) throw new GoogleOAuthError('token');
      const [h, p, s] = parts as [string, string, string];
      let header: { kid?: string; alg?: string };
      let claims: Record<string, unknown>;
      try {
        header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
        claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
      } catch {
        throw new GoogleOAuthError('token');
      }
      await verifySignature(header, `${h}.${p}`, Buffer.from(s, 'base64url'));

      if (typeof claims.iss !== 'string' || !ISSUERS.has(claims.iss))
        throw new GoogleOAuthError('issuer');
      const aud = claims.aud;
      const audiences = Array.isArray(aud) ? aud : [aud];
      if (!audiences.includes(config.clientId)) throw new GoogleOAuthError('audience');
      if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS <= now() / 1000)
        throw new GoogleOAuthError('expired');
      const given = Buffer.from(String(claims.nonce ?? ''));
      const wanted = Buffer.from(nonce);
      if (given.length !== wanted.length || !timingSafeEqual(given, wanted))
        throw new GoogleOAuthError('nonce');
      if (typeof claims.sub !== 'string' || claims.sub === '' || claims.sub.length > 255)
        throw new GoogleOAuthError('claims');
      if (typeof claims.email !== 'string' || claims.email === '')
        throw new GoogleOAuthError('claims');
      return {
        sub: claims.sub,
        email: claims.email,
        emailVerified: claims.email_verified === true,
      };
    },
  };
}
