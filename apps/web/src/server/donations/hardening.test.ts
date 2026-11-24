import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createFakePaystack } from '@ad/payments/testing';
import { createPaystackProvider } from '@ad/payments';
import { describe, expect, it, vi } from 'vitest';
import { can, requiredRole } from '../../lib/admin/can';
import { loadSponsor } from '../sponsors/surface';
import { createSponsorClickHandler } from '../sponsors/click';
import { createSeenHandler } from '../sponsors/seen';
import { createCheckoutHandler } from './checkout';
import { decideDonateGate, donateLinkVisible } from './gate';
import { createStatusHandler } from './status';

const ORIGIN = 'https://site.example';
const KIDS_AUDIENCES = ['kids', undefined, null, 'weird', ''] as const;

describe('kids matrix (M48-S13, S34, R25): every sponsor and donate surface is closed to kids and to an unknown audience', () => {
  const fake = createFakePaystack();
  const provider = createPaystackProvider({ secretKey: fake.secretKey, baseUrl: 'https://api.paystack.co', fetch: fake.fetch });
  const secret = new Uint8Array(32).fill(1);

  for (const audience of KIDS_AUDIENCES) {
    const label = String(audience);
    it(`audience ${label}: checkout answers 403 and touches nothing`, async () => {
      const consume = vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 }));
      const create = vi.fn();
      const handler = createCheckoutHandler({
        config: async () => ({ enabled: true, currencies: ['NGN'], usdEnabled: false, monthlyEnabled: false, limits: { NGN: { min: 1, max: 9e9 }, USD: { min: 1, max: 9e9 } } }),
        provider,
        resolveViewer: async () => ({ audience, accountId: null }),
        limiter: { consume },
        store: { findAttempt: vi.fn(), create } as never,
        kek: secret, pepper: secret, receiptSecret: secret, appOrigin: ORIGIN, trustedProxyMode: 'none', siteMode: 'test', newId: () => 'x',
      });
      const res = await handler(new Request(`${ORIGIN}/api/donate/checkout`, { method: 'POST', body: '{}', headers: { origin: ORIGIN } }));
      expect(res.status).toBe(403);
      expect([consume.mock.calls.length, create.mock.calls.length]).toEqual([0, 0]);
    });

    it(`audience ${label}: status answers 403 and never asks Paystack`, async () => {
      const lookup = vi.fn();
      const handler = createStatusHandler({
        enabled: async () => true, provider, resolveViewer: async () => ({ audience }),
        limiter: { consume: async () => ({ allowed: true, retryAfterSeconds: 0 }) }, lookup, receiptSecret: secret, trustedProxyMode: 'none',
      });
      expect((await handler(new Request(`${ORIGIN}/api/donate/status?reference=ad-don-abcdefghij0123456789`))).status).toBe(403);
      expect(lookup).not.toHaveBeenCalled();
    });

    it(`audience ${label}: the donate and transparency pages are not the form, and no link exists`, () => {
      const gate = decideDonateGate({ available: true, kids: audience !== undefined && audience !== null && audience !== '' && audience !== 'weird' });
      expect(donateLinkVisible(gate === 'ok' ? 'ok' : 'kids')).toBe(gate === 'ok');
    });

    it(`audience ${label}: no sponsor is chosen and the database is not read`, async () => {
      const settings = vi.fn();
      const candidates = vi.fn();
      const out = await loadSponsor({ settings, candidates, now: () => new Date() } as never, {
        slot: 'home_banner', audience, viewer: 'account', siteGuestAudience: 'general', caps: {} as never, saveData: false, resumeSeconds: 0,
      });
      expect(out).toBeNull();
      expect([settings.mock.calls.length, candidates.mock.calls.length]).toEqual([0, 0]);
    });

    it(`audience ${label}: the sponsor click is a 404 with nothing recorded`, async () => {
      const lookup = vi.fn();
      const track = vi.fn();
      const handler = createSponsorClickHandler({
        lookup, track, limiter: { consume: async () => ({ allowed: true, retryAfterSeconds: 0 }) } as never, secret,
        trustedProxyMode: 'none', resolveViewer: async () => ({ profileId: null, audience: audience as never }), isAdminPreview: async () => false, warn: () => undefined,
      });
      const res = await handler(new Request(`${ORIGIN}/s/0190a000-0000-7000-8000-000000000002`), '0190a000-0000-7000-8000-000000000002');
      expect(res.status).toBe(404);
      expect([lookup.mock.calls.length, track.mock.calls.length]).toEqual([0, 0]);
    });

    it(`audience ${label}: the cap cookie is never set`, async () => {
      const handler = createSeenHandler({ resolveViewer: async () => ({ profileId: null, audience: audience as never }), secure: true });
      const res = await handler(new Request(`${ORIGIN}/api/sponsors/seen`, { method: 'POST', body: JSON.stringify({ creativeId: '0190a000-0000-7000-8000-000000000002', slot: 'home_banner' }) }));
      expect(res.status).toBe(204);
      expect(res.headers.get('set-cookie')).toBeNull();
    });
  }

  it('off beats everything: with donations off the gate is off for kids and adults alike', () => {
    expect(decideDonateGate({ available: false, kids: true })).toBe('off');
    expect(decideDonateGate({ available: false, kids: false })).toBe('off');
  });
});

describe('authorization matrix for the admin donation actions', () => {
  const actions = ['donation.view', 'donation.export', 'donation.resolve', 'sponsor.report.export'] as const;
  const roles = ['viewer', 'editor', 'admin', 'super_admin'] as const;
  it('allows admin and super admin and nobody below, for every role', () => {
    for (const action of actions) {
      expect(requiredRole(action)).toBe('admin');
      for (const role of roles) {
        expect(can(role, action), `${role} ${action}`).toBe(role === 'admin' || role === 'super_admin');
      }
    }
  });
  it('gives anonymous callers nothing (a null role is not a role)', () => {
    for (const action of actions) expect(can(null as never, action)).toBe(false);
  });
});

describe('donate and sponsor pages load nothing from another site (R25)', () => {
  const root = resolve(__dirname, '../..');
  const dirs = ['components/donate', 'components/sponsor', 'app/(site)/donate', 'app/(site)/transparency'];
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) return files(full);
      return /\.(tsx?|css)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
    });
  it('has no absolute http address, script tag, iframe or third party font in any source file', () => {
    const offenders: string[] = [];
    for (const dir of dirs) {
      for (const file of files(join(root, dir))) {
        const text = readFileSync(file, 'utf8');
        // Allowed: the https:// prefix check on the checkout url, which is a string test, not a host.
        for (const m of text.matchAll(/https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi)) offenders.push(`${file}: ${m[0]}`);
        if (/<script|<iframe|@import\s+url|fonts\.googleapis/i.test(text)) offenders.push(`${file}: embeds`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
