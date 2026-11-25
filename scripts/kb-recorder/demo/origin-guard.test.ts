import { describe, expect, it } from 'vitest';
import { assertAllowedDatabase, assertAllowedOrigin } from './origin-guard';

describe('recorder origin guard', () => {
  it.each([
    'http://localhost:3141',
    'http://localhost',
    'http://127.0.0.1:3000/admin',
    'http://[::1]:3000',
  ])('allows %s', (u) => expect(() => assertAllowedOrigin(u)).not.toThrow());

  it.each([
    'https://admin.angelsdelight.tv',
    'https://staging.example.com',
    'http://localhost.evil.com',
    'http://evil.com/localhost',
    'https://localhost@evil.com',
    'ftp://localhost',
    'not a url',
  ])('refuses %s', (u) => expect(() => assertAllowedOrigin(u)).toThrow(/refus/i));

  it('allows exactly the demo host named in the environment', () => {
    const env = { KB_DEMO_HOST: 'kb-demo.example.test' };
    expect(() => assertAllowedOrigin('https://kb-demo.example.test', { env })).not.toThrow();
    expect(() => assertAllowedOrigin('https://other.example.test', { env })).toThrow(/refus/i);
    expect(() => assertAllowedOrigin('https://kb-demo.example.test.evil.com', { env })).toThrow(
      /refus/i,
    );
  });

  it('never allows a demo host that is not a reserved example name', () => {
    expect(() =>
      assertAllowedOrigin('https://angelsdelight.tv', {
        env: { KB_DEMO_HOST: 'angelsdelight.tv' },
      }),
    ).toThrow(/refus/i);
  });
});

describe('recorder database guard', () => {
  it('allows only the demo databases', () => {
    expect(() => assertAllowedDatabase('postgres://u:p@localhost:5432/ad_kb')).not.toThrow();
    expect(() => assertAllowedDatabase('postgres://u:p@localhost:5432/ad_kb_keys')).not.toThrow();
    expect(() => assertAllowedDatabase('postgres://u:p@db.prod.internal/ad_kb')).toThrow(/refus/i);
    expect(() => assertAllowedDatabase('postgres://u:p@localhost:5432/ad_prod')).toThrow(/refus/i);
    expect(() => assertAllowedDatabase('postgres://u:p@localhost:5432/ad_kb_staging')).toThrow(
      /refus/i,
    );
  });
});
