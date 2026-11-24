import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULT_SESSION_POLICIES, PENDING_MFA_SECONDS } from '@ad/auth';
import { describe, expect, it } from 'vitest';
import { DEVICE_COOKIE_DAYS } from '../../server/auth/cookies';
import { GUEST_AUDIENCE_DAYS } from '../../server/guest/guest-audience';
import { GUEST_COOKIE_DAYS } from '../../server/guest/guest-cookie';
import { LOCALE_COOKIE_MAX_AGE } from '../i18n/cookie';
import { ALWAYS_ASK_MAX_AGE } from '../profiles/always-ask';
import { PICKER_CACHE_MAX_AGE_MS } from '../profiles/picker-cache';
import { GUEST_INTENT_MAX_AGE_MS } from '../guest/intent';
import { NOTICE_MAX_AGE_MS } from './notice';
import { STORAGE_INVENTORY, durationText, visitorInventory } from './inventory';

const REPO = resolve(__dirname, '../../../../..');
const WEB_SRC = resolve(__dirname, '../..');

const PLACEHOLDER = /confirm at build|todo|tbd|placeholder|unverified|guess|\?\?/i;

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|int\.test|e2e|stack)\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe('storage inventory (M45-S11)', () => {
  it('has no placeholder or unverified entry', () => {
    for (const item of STORAGE_INVENTORY) {
      expect(item.verified, item.name).toBe(true);
      for (const text of [item.name, item.purpose, item.kept, item.source, item.needle]) {
        expect(text, item.name).not.toMatch(PLACEHOLDER);
        expect(text.trim().length, item.name).toBeGreaterThan(0);
      }
    }
  });

  it('points every entry at code that really contains its name', () => {
    for (const item of STORAGE_INVENTORY) {
      const file = join(REPO, item.source);
      expect(existsSync(file), `${item.name} source ${item.source}`).toBe(true);
      expect(readFileSync(file, 'utf8'), `${item.name} in ${item.source}`).toContain(item.needle);
    }
  });

  it('has no duplicate names and no marketing or tracking entry', () => {
    const names = STORAGE_INVENTORY.map((item) => item.name);
    expect(new Set(names).size).toBe(names.length);
    for (const item of STORAGE_INVENTORY) {
      expect(['necessary', 'functional']).toContain(item.type);
    }
  });

  it('states durations that match the constants in the code', () => {
    const seconds = (name: string) => STORAGE_INVENTORY.find((item) => item.name === name)?.seconds;
    expect(seconds('__Host-ad_session')).toBe(DEFAULT_SESSION_POLICIES.viewer.idleSeconds);
    expect(seconds('__Host-ad_mv')).toBe(PENDING_MFA_SECONDS);
    expect(seconds('__Host-ad_guest')).toBe(GUEST_COOKIE_DAYS * 86400);
    expect(seconds('__Host-ad_gaud')).toBe(GUEST_AUDIENCE_DAYS * 86400);
    expect(seconds('ad_locale')).toBe(LOCALE_COOKIE_MAX_AGE);
    expect(seconds('ad_always_ask')).toBe(ALWAYS_ASK_MAX_AGE);
    expect(seconds('ad_acct')).toBe(ALWAYS_ASK_MAX_AGE);
    expect(seconds('ad.pickercache.v1')).toBe(PICKER_CACHE_MAX_AGE_MS / 1000);
    expect(seconds('ad:guest:intent:v1')).toBe(GUEST_INTENT_MAX_AGE_MS / 1000);
    expect(seconds('ad:notice:v1')).toBe(NOTICE_MAX_AGE_MS / 1000);
    expect(seconds('__Host-ad_dev')).toBe(DEVICE_COOKIE_DAYS * 86400);
    expect(seconds('__Host-ad_profile')).toBe(30 * 86400);
    for (const item of STORAGE_INVENTORY) {
      if (item.seconds !== undefined) expect(item.kept, item.name).toContain(durationText(item.seconds));
    }
  });

  it('writes durations in plain words', () => {
    expect(durationText(600)).toBe('10 minutes');
    expect(durationText(1800)).toBe('30 minutes');
    expect(durationText(86400)).toBe('1 day');
    expect(durationText(7 * 86400)).toBe('7 days');
    expect(durationText(180 * 86400)).toBe('180 days');
    expect(durationText(365 * 86400)).toBe('12 months');
    expect(durationText(400 * 86400)).toBe('13 months');
  });

  it('names the guest Kids mode choice and the import answer (R17) and the real guest cookie (R19)', () => {
    const names = STORAGE_INVENTORY.map((item) => item.name);
    expect(names).toContain('__Host-ad_gaud');
    expect(names).toContain('ad:guest:import-asked');
    expect(names).toContain('__Host-ad_guest');
    expect(names).not.toContain('ad_guest');
    const progress = STORAGE_INVENTORY.find((item) => item.name === 'ad:guest:progress:v1');
    expect(progress?.kept).toContain('100');
    const recent = STORAGE_INVENTORY.find((item) => item.name === 'ad-recent-searches');
    expect(recent?.kept).toMatch(/5/);
    expect(recent?.kept).toMatch(/Kids/);
  });

  it('lists every storage key and cookie declared in the code', () => {
    const files = [...sources(WEB_SRC), ...sources(join(REPO, 'packages/player/src'))];
    const found = new Set<string>();
    const declared =
      /(?:const|let)\s+\w*(?:KEY|COOKIE|CACHE|ASKED)\w*\s*=\s*['"]([^'"]+)['"]/g;
    const cookieChoice = /\?\s*'(__Host-ad_[a-z]+)'\s*:\s*'(ad_[a-z]+)'/g;
    const keyFunction = /Key\s*=\s*\([^)]*\)\s*(?::\s*string\s*)?=>\s*`([^`$]+)\$/g;
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(declared)) found.add(m[1]!);
      for (const m of text.matchAll(cookieChoice)) found.add(m[1]!);
      for (const m of text.matchAll(keyFunction)) found.add(m[1]!);
    }
    // Development only: fixture sign in cookies and the fixture progress adapter (behind the dev flag), and the
    // plain development cookie names, which have a __Host- row.
    const ignore = [/^ad\.progress\.$/, /^ad_fixture/, /^ad-key:/, /^public, max-age/, /^ad_fixture_/, /^ad_session$/, /^ad_profile$/];
    const names = STORAGE_INVENTORY.map((item) => item.name);
    const missing = [...found].filter(
      (key) =>
        !ignore.some((re) => re.test(key)) &&
        !names.some((name) => name === key || name.startsWith(key) || key.startsWith(name.split('<')[0]!)),
    );
    expect(missing).toEqual([]);
  });

  it('shows visitors every visitor entry and keeps staff only keys out of the public list', () => {
    const visitor = visitorInventory();
    expect(visitor.length).toBeGreaterThan(10);
    expect(visitor.every((item) => item.audience === 'visitor')).toBe(true);
    expect(STORAGE_INVENTORY.some((item) => item.audience === 'staff')).toBe(true);
  });
});
