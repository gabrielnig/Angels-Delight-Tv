import { describe, expect, it, vi } from 'vitest';
import type { SponsorCandidate, SponsorSettings } from '@ad/sponsors';
import { loadSponsor, type SurfaceDeps } from './surface';

const settings: SponsorSettings = {
  enabled: true,
  placements: { home_banner: true, title_card: true, player_after: true, player_before: true },
  caps: { home_banner: 2, title_card: 2, player_after: 1, player_before: 1 },
  rotation: 'even',
  label: 'sponsored',
  linkNewTab: true,
  homeAfterRow: 2,
  beforeSeconds: 5,
};
const candidate: SponsorCandidate = {
  sponsorId: '0190a000-0000-7000-8000-000000000001',
  sponsorName: 'Acme',
  status: 'active',
  startsAt: null,
  endsAt: null,
  creativeId: '0190a000-0000-7000-8000-000000000002',
  headline: 'Learn',
  body: null,
  ctaLabel: 'Visit',
  destinationUrl: 'https://acme.example',
  imageSquareUrl: null,
  imageWideUrl: null,
  altText: null,
  weight: 1,
  active: true,
  slots: ['home_banner', 'title_card'],
};
const deps = (over: Partial<SurfaceDeps> = {}): SurfaceDeps => ({
  settings: vi.fn().mockResolvedValue(settings),
  candidates: vi.fn().mockResolvedValue([candidate]),
  now: () => new Date('2027-01-05T10:00:00Z'),
  ...over,
});
const input = (over: Record<string, unknown> = {}) => ({
  slot: 'home_banner' as const,
  audience: 'general' as unknown,
  viewer: 'account' as const,
  siteGuestAudience: 'general' as const,
  caps: {},
  saveData: false,
  resumeSeconds: 0,
  ...over,
});

describe('loadSponsor', () => {
  it('returns a creative for an adult when everything is on', async () => {
    const out = await loadSponsor(deps(), input());
    expect(out?.creativeId).toBe(candidate.creativeId);
    expect(out?.href).toBe(`/s/${candidate.creativeId}`);
  });
  it('never reads the database for a kids audience', async () => {
    const d = deps();
    expect(await loadSponsor(d, input({ audience: 'kids' }))).toBeNull();
    expect(d.candidates).not.toHaveBeenCalled();
  });
  it('treats an unknown audience as kids', async () => {
    const d = deps();
    expect(await loadSponsor(d, input({ audience: undefined }))).toBeNull();
    expect(await loadSponsor(d, input({ audience: 'General' }))).toBeNull();
    expect(d.candidates).not.toHaveBeenCalled();
  });
  it('does not read candidates when the master switch is off', async () => {
    const d = deps({ settings: vi.fn().mockResolvedValue({ ...settings, enabled: false }) });
    expect(await loadSponsor(d, input())).toBeNull();
    expect(d.candidates).not.toHaveBeenCalled();
  });
  it('does not read candidates when the slot is off', async () => {
    const d = deps({
      settings: vi
        .fn()
        .mockResolvedValue({
          ...settings,
          placements: { ...settings.placements, home_banner: false },
        }),
    });
    expect(await loadSponsor(d, input())).toBeNull();
    expect(d.candidates).not.toHaveBeenCalled();
  });
  it('fails closed when settings or the database throw', async () => {
    expect(
      await loadSponsor(deps({ settings: vi.fn().mockRejectedValue(new Error('x')) }), input()),
    ).toBeNull();
    expect(
      await loadSponsor(deps({ candidates: vi.fn().mockRejectedValue(new Error('x')) }), input()),
    ).toBeNull();
  });
  it('shows a guest nothing when the site guest audience is kids', async () => {
    const d = deps();
    expect(await loadSponsor(d, input({ viewer: 'guest', siteGuestAudience: 'kids' }))).toBeNull();
    expect(d.candidates).not.toHaveBeenCalled();
  });
});
