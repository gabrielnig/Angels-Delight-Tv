import { describe, expect, it } from 'vitest';
import { FakeGoogle } from './fake-google';
import { createGoogleClient, GoogleOAuthError, newOAuthParams } from './google';

function setup() {
  const fake = new FakeGoogle();
  const client = createGoogleClient(
    { clientId: fake.clientId, clientSecret: fake.clientSecret, redirectUri: fake.redirectUri },
    { fetch: fake.fetch, now: () => fake.now() },
  );
  const params = newOAuthParams();
  const start = () => client.authorizationUrl(params);
  return { fake, client, params, start };
}

const user = { sub: 'g-1', email: 'ada@example.org' };

async function reason(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof GoogleOAuthError) return error.reason;
    throw error;
  }
  return 'no error';
}

describe('google oauth client', () => {
  it('builds an authorization code url with pkce, state, nonce and no secret', () => {
    const { start, params, fake } = setup();
    const url = new URL(start());
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('client_id')).toBe(fake.clientId);
    expect(url.searchParams.get('redirect_uri')).toBe(fake.redirectUri);
    expect(url.searchParams.get('state')).toBe(params.state);
    expect(url.searchParams.get('nonce')).toBe(params.nonce);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(params.challenge);
    expect(url.toString()).not.toContain(fake.clientSecret);
    expect(params.verifier.length).toBeGreaterThanOrEqual(43);
  });

  it('returns the verified profile for a good exchange', async () => {
    const { fake, client, params, start } = setup();
    const { code } = fake.authorize(start(), user);
    await expect(
      client.exchange({ code, codeVerifier: params.verifier, nonce: params.nonce }),
    ).resolves.toEqual({ sub: 'g-1', email: 'ada@example.org', emailVerified: true });
  });

  it('keeps the secret out of everything but the token request body', async () => {
    const { fake, client, params, start } = setup();
    const { code } = fake.authorize(start(), user);
    await client.exchange({ code, codeVerifier: params.verifier, nonce: params.nonce });
    const withSecret = fake.requests.filter((r) => r.body.includes(fake.clientSecret));
    expect(withSecret).toHaveLength(1);
    expect(withSecret[0]?.url.endsWith('/token')).toBe(true);
  });

  it('rejects wrong audience', async () => {
    const { fake, client, params, start } = setup();
    const { code } = fake.authorize(start(), { ...user, claims: { aud: 'someone-else' } });
    expect(
      await reason(client.exchange({ code, codeVerifier: params.verifier, nonce: params.nonce })),
    ).toBe('audience');
  });

  it('rejects wrong issuer', async () => {
    const { fake, client, params, start } = setup();
    const { code } = fake.authorize(start(), { ...user, claims: { iss: 'https://evil.test' } });
    expect(
      await reason(client.exchange({ code, codeVerifier: params.verifier, nonce: params.nonce })),
    ).toBe('issuer');
  });

  it('rejects expired id token', async () => {
    const { fake, client, params, start } = setup();
    const past = Math.floor(Date.now() / 1000) - 7200;
    const { code } = fake.authorize(start(), { ...user, claims: { iat: past, exp: past + 60 } });
    expect(
      await reason(client.exchange({ code, codeVerifier: params.verifier, nonce: params.nonce })),
    ).toBe('expired');
  });

  it('rejects bad nonce or state', async () => {
    const { fake, client, params, start } = setup();
    const { code } = fake.authorize(start(), user);
    expect(
      await reason(client.exchange({ code, codeVerifier: params.verifier, nonce: 'other-nonce' })),
    ).toBe('nonce');
  });

  it('rejects a token signed by a key Google does not publish', async () => {
    const { fake, client, params, start } = setup();
    const { code } = fake.authorize(start(), user);
    const now = Math.floor(Date.now() / 1000);
    fake.forceIdToken = fake.signToken(
      {
        iss: 'https://accounts.google.com',
        aud: fake.clientId,
        sub: 'g-1',
        email: 'ada@example.org',
        email_verified: true,
        nonce: params.nonce,
        iat: now,
        exp: now + 600,
      },
      { key: FakeGoogle.strangerKey() },
    );
    expect(
      await reason(client.exchange({ code, codeVerifier: params.verifier, nonce: params.nonce })),
    ).toBe('signature');
  });

  it('rejects code replay', async () => {
    const { fake, client, params, start } = setup();
    const { code } = fake.authorize(start(), user);
    await client.exchange({ code, codeVerifier: params.verifier, nonce: params.nonce });
    expect(
      await reason(client.exchange({ code, codeVerifier: params.verifier, nonce: params.nonce })),
    ).toBe('exchange');
  });

  it('pkce verifier is required and must match', async () => {
    const { fake, client, params, start } = setup();
    const { code } = fake.authorize(start(), user);
    expect(await reason(client.exchange({ code, codeVerifier: '', nonce: params.nonce }))).toBe(
      'verifier',
    );
    expect(
      await reason(client.exchange({ code, codeVerifier: 'x'.repeat(50), nonce: params.nonce })),
    ).toBe('exchange');
  });

  it('reports an unverified email as false, and only boolean true counts as verified', async () => {
    for (const [given, expected] of [
      [false, false],
      ['true', false],
    ] as const) {
      const { fake, client, params, start } = setup();
      const { code } = fake.authorize(start(), { ...user, emailVerified: given as never });
      const profile = await client.exchange({
        code,
        codeVerifier: params.verifier,
        nonce: params.nonce,
      });
      expect(profile.emailVerified).toBe(expected);
    }
    const { fake, client, params, start } = setup();
    const { code } = fake.authorize(start(), { ...user, claims: { email_verified: undefined } });
    const profile = await client.exchange({
      code,
      codeVerifier: params.verifier,
      nonce: params.nonce,
    });
    expect(profile.emailVerified).toBe(false);
  });

  it('fails closed when the key set cannot be fetched', async () => {
    const { fake, params, start } = setup();
    const client = createGoogleClient(
      { clientId: fake.clientId, clientSecret: fake.clientSecret, redirectUri: fake.redirectUri },
      {
        fetch: async (input, init) =>
          String(input).endsWith('/certs')
            ? new Response('down', { status: 503 })
            : fake.fetch(input, init),
      },
    );
    const { code } = fake.authorize(start(), user);
    expect(
      await reason(client.exchange({ code, codeVerifier: params.verifier, nonce: params.nonce })),
    ).toBe('keys');
  });
});
