import { describe, expect, it } from 'vitest';
import { tvModeFromHeaders } from './server';

const TIZEN = 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 TV Safari/537.36';
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const h = (init: Record<string, string>) => new Headers(init);

describe('tvModeFromHeaders', () => {
  it('is off for a desktop with no cookie', () => {
    expect(tvModeFromHeaders(h({ 'user-agent': DESKTOP }))).toBe(false);
  });
  it('is on for a TV user agent', () => {
    expect(tvModeFromHeaders(h({ 'user-agent': TIZEN }))).toBe(true);
  });
  it('the cookie beats the user agent both ways', () => {
    expect(tvModeFromHeaders(h({ 'user-agent': DESKTOP, cookie: 'a=1; ad_tv=on; b=2' }))).toBe(
      true,
    );
    expect(tvModeFromHeaders(h({ 'user-agent': TIZEN, cookie: 'ad_tv=off' }))).toBe(false);
  });
  it('ignores a junk cookie value', () => {
    expect(tvModeFromHeaders(h({ 'user-agent': TIZEN, cookie: 'ad_tv=zzz' }))).toBe(true);
  });
  it('copes with no headers at all', () => {
    expect(tvModeFromHeaders(h({}))).toBe(false);
  });
});
