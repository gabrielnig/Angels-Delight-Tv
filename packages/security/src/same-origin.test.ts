import { Forbidden } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { assertSameOrigin } from './same-origin';

const APP = 'https://tv.example.org';

describe('assertSameOrigin', () => {
  it('accepts a matching Origin header', () => {
    expect(() => assertSameOrigin(new Headers({ origin: APP }), APP)).not.toThrow();
  });

  it('rejects a different Origin even when Sec-Fetch-Site claims same-origin', () => {
    const headers = new Headers({
      origin: 'https://evil.example',
      'sec-fetch-site': 'same-origin',
    });
    expect(() => assertSameOrigin(headers, APP)).toThrow(Forbidden);
  });

  it('rejects the string null origin', () => {
    expect(() => assertSameOrigin(new Headers({ origin: 'null' }), APP)).toThrow(Forbidden);
  });

  it('falls back to Sec-Fetch-Site same-origin when Origin is absent', () => {
    expect(() =>
      assertSameOrigin(new Headers({ 'sec-fetch-site': 'same-origin' }), APP),
    ).not.toThrow();
  });

  it('rejects a cross-site request that carries neither signal', () => {
    expect(() => assertSameOrigin(new Headers({ 'sec-fetch-site': 'cross-site' }), APP)).toThrow(
      Forbidden,
    );
    expect(() => assertSameOrigin(new Headers(), APP)).toThrow(Forbidden);
  });

  it('compares origins exactly, not by prefix', () => {
    expect(() => assertSameOrigin(new Headers({ origin: `${APP}.evil.example` }), APP)).toThrow(
      Forbidden,
    );
  });
});
