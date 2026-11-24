import { describe, expect, it } from 'vitest';
import {
  CAP_COOKIE_MAX_ENTRIES,
  capCookieName,
  capCookieOptions,
  capCount,
  parseCapCookie,
  recordImpression,
  serializeCapCookie,
} from './caps';

const A = '0198c000-0000-7000-8000-00000000000a';
const B = '0198c000-0000-7000-8000-00000000000b';

describe('frequency cap cookie', () => {
  it('parses a valid cap cookie', () => {
    const raw = serializeCapCookie(recordImpression(recordImpression({}, A, 'home_banner', 100), A, 'home_banner', 100));
    const map = parseCapCookie(raw, 100);
    expect(capCount(map, A, 'home_banner', 100)).toBe(2);
    expect(capCount(map, A, 'title_card', 100)).toBe(0);
  });

  it('ignores a malformed or oversized cookie', () => {
    for (const raw of [undefined, '', 'not json', '{"a":1}', '[1,2]', 'null', '%E0%A4%A', 'x'.repeat(5000)]) {
      expect(parseCapCookie(raw, 100)).toEqual({});
    }
    const oversize = JSON.stringify({ [`${A}.h`]: [100, 1], pad: 'p'.repeat(3000) });
    expect(parseCapCookie(encodeURIComponent(oversize), 100)).toEqual({});
  });

  it('ignores entries with bad keys or counts', () => {
    const raw = encodeURIComponent(
      JSON.stringify({ 'not-a-uuid.h': [100, 1], [`${A}.z`]: [100, 1], [`${A}.t`]: [100, -4], [`${B}.h`]: [100, 2.5], [`${B}.a`]: [100, 3] }),
    );
    const map = parseCapCookie(raw, 100);
    expect(Object.keys(map)).toEqual([`${B}.a`]);
  });

  it('drops entries from earlier Lagos days', () => {
    const raw = serializeCapCookie(recordImpression({}, A, 'home_banner', 99));
    expect(parseCapCookie(raw, 100)).toEqual({});
    expect(capCount(parseCapCookie(raw, 99), A, 'home_banner', 99)).toBe(1);
  });

  it('increments and caps entry count at 20', () => {
    let map = {};
    for (let i = 0; i < CAP_COOKIE_MAX_ENTRIES + 5; i += 1) {
      const id = `0198c000-0000-7000-8000-${String(i).padStart(12, '0')}`;
      map = recordImpression(map, id, 'home_banner', 100);
    }
    expect(Object.keys(map)).toHaveLength(CAP_COOKIE_MAX_ENTRIES);
    const again = recordImpression(recordImpression({}, A, 'title_card', 100), A, 'title_card', 100);
    expect(capCount(again, A, 'title_card', 100)).toBe(2);
  });

  it('the newest entries survive when the map is full', () => {
    let map = {};
    for (let i = 0; i < CAP_COOKIE_MAX_ENTRIES; i += 1) {
      map = recordImpression(map, `0198c000-0000-7000-8000-${String(i).padStart(12, '0')}`, 'home_banner', 100);
    }
    map = recordImpression(map, A, 'home_banner', 101);
    expect(capCount(map, A, 'home_banner', 101)).toBe(1);
  });

  it('cookie holds no identifier', () => {
    const raw = serializeCapCookie(recordImpression({}, A, 'home_banner', 100));
    const decoded = decodeURIComponent(raw);
    expect(decoded).toContain(A);
    expect(decoded).not.toMatch(/viewer|guest|account|profile|session|user/i);
    expect(JSON.parse(decoded)).toEqual({ [`${A}.h`]: [100, 1] });
  });

  it('day caps use a one day cookie and session caps use a session cookie', () => {
    expect(capCookieName('home_banner')).toBe('ad_spc');
    expect(capCookieName('title_card')).toBe('ad_spc');
    expect(capCookieName('player_before')).toBe('ad_sps');
    expect(capCookieName('player_after')).toBe('ad_sps');
    expect(capCookieOptions('home_banner', true)).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 86400 });
    const session = capCookieOptions('player_after', false);
    expect(session.maxAge).toBeUndefined();
    expect(session.secure).toBe(false);
  });
});
