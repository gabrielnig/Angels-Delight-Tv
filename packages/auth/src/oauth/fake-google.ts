import {
  createHash,
  createSign,
  generateKeyPairSync,
  randomBytes,
  type KeyObject,
} from 'node:crypto';

/**
 * A stand in for Google's authorization, token and key endpoints, used by tests only. It signs real RS256 ID
 * tokens with a throwaway key and enforces what Google enforces: a code works once, and the PKCE verifier must
 * match the challenge sent at the start.
 */
export interface FakeUser {
  sub: string;
  email: string;
  emailVerified?: boolean | string;
  /** Overrides for claims, to build bad tokens. */
  claims?: Record<string, unknown>;
}

const b64url = (input: Buffer | string): string => Buffer.from(input).toString('base64url');

export class FakeGoogle {
  readonly clientId = 'test-client.apps.googleusercontent.com';
  readonly clientSecret = 'test-secret';
  readonly redirectUri = 'https://app.test/api/auth/google/callback';
  now = () => Date.now();
  private readonly keys: { privateKey: KeyObject; jwk: Record<string, unknown> };
  private readonly codes = new Map<
    string,
    { user: FakeUser; challenge: string; nonce: string; used: boolean }
  >();
  /** Every request the app made, for assertions. */
  readonly requests: { url: string; body: string }[] = [];
  /** The id token the next exchange returns instead of a built one. */
  forceIdToken: string | null = null;

  constructor(readonly kid = 'k1') {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    this.keys = {
      privateKey,
      jwk: { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' },
    };
  }

  /** What the browser would do: follow the authorization URL, sign in, and come back with a code. */
  authorize(authorizationUrl: string, user: FakeUser): { code: string; state: string } {
    const url = new URL(authorizationUrl);
    const code = b64url(randomBytes(12));
    this.codes.set(code, {
      user,
      challenge: url.searchParams.get('code_challenge') ?? '',
      nonce: url.searchParams.get('nonce') ?? '',
      used: false,
    });
    return { code, state: url.searchParams.get('state') ?? '' };
  }

  signToken(
    claims: Record<string, unknown>,
    options: { kid?: string; key?: KeyObject } = {},
  ): string {
    const header = b64url(
      JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: options.kid ?? this.kid }),
    );
    const body = b64url(JSON.stringify(claims));
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${body}`);
    return `${header}.${body}.${b64url(signer.sign(options.key ?? this.keys.privateKey))}`;
  }

  /** A key that is not in the published set, for the wrong signature test. */
  static strangerKey(): KeyObject {
    return generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  }

  private idTokenFor(entry: { user: FakeUser; nonce: string }): string {
    const iat = Math.floor(this.now() / 1000);
    return this.signToken({
      iss: 'https://accounts.google.com',
      aud: this.clientId,
      sub: entry.user.sub,
      email: entry.user.email,
      email_verified: entry.user.emailVerified ?? true,
      nonce: entry.nonce,
      iat,
      exp: iat + 3600,
      ...entry.user.claims,
    });
  }

  readonly fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const body = init?.body ? String(init.body) : '';
    this.requests.push({ url, body });
    if (url.endsWith('/oauth2/v3/certs')) {
      return Response.json({ keys: [this.keys.jwk] });
    }
    if (url.endsWith('/token')) {
      const form = new URLSearchParams(body);
      const entry = this.codes.get(form.get('code') ?? '');
      const fail = (error: string) => Response.json({ error }, { status: 400 });
      if (!entry || entry.used) return fail('invalid_grant');
      if (
        form.get('client_id') !== this.clientId ||
        form.get('client_secret') !== this.clientSecret
      )
        return fail('invalid_client');
      if (form.get('redirect_uri') !== this.redirectUri) return fail('redirect_uri_mismatch');
      const verifier = form.get('code_verifier');
      if (!verifier) return fail('invalid_grant');
      if (b64url(createHash('sha256').update(verifier).digest()) !== entry.challenge)
        return fail('invalid_grant');
      entry.used = true;
      return Response.json({
        access_token: 'unused',
        token_type: 'Bearer',
        id_token: this.forceIdToken ?? this.idTokenFor(entry),
      });
    }
    return new Response('not found', { status: 404 });
  };
}
