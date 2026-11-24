import { describe, expect, it } from 'vitest';
import { googleConfigFrom, googleEnabled } from './google-enabled';

const env = {
  APP_ORIGIN: 'https://tv.example.org',
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
};

describe('google availability', () => {
  it('builds the redirect uri from the app origin', () => {
    expect(googleConfigFrom(env)).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
      redirectUri: 'https://tv.example.org/api/auth/google/callback',
    });
    expect(googleConfigFrom({ ...env, APP_ORIGIN: 'https://tv.example.org/' })?.redirectUri).toBe(
      'https://tv.example.org/api/auth/google/callback',
    );
  });

  it('is absent without both keys', () => {
    expect(googleConfigFrom({ APP_ORIGIN: env.APP_ORIGIN })).toBeNull();
    expect(googleConfigFrom({ ...env, GOOGLE_CLIENT_SECRET: undefined })).toBeNull();
    expect(googleConfigFrom({ ...env, GOOGLE_CLIENT_ID: undefined })).toBeNull();
  });

  it('is on only with keys and the site setting on', async () => {
    expect(await googleEnabled(env, async () => true)).toBe(true);
    expect(await googleEnabled(env, async () => false)).toBe(false);
    expect(await googleEnabled({ APP_ORIGIN: env.APP_ORIGIN }, async () => true)).toBe(false);
  });

  it('is off, not an error, when the setting cannot be read', async () => {
    expect(
      await googleEnabled(env, async () => {
        throw new Error('db down');
      }),
    ).toBe(false);
  });

  it('never reads the setting when there are no keys', async () => {
    let read = false;
    await googleEnabled({ APP_ORIGIN: env.APP_ORIGIN }, async () => {
      read = true;
      return true;
    });
    expect(read).toBe(false);
  });
});
