import { describe, expect, it } from 'vitest';
import { recordImpression } from './caps';
import { isGeneralAudience, selectSponsor, type SelectInput, type SponsorCandidate, type SponsorSettings } from './select';

const NOW = new Date('2026-12-10T10:00:00Z');
const ID1 = '0198c000-0000-7000-8000-000000000001';
const ID2 = '0198c000-0000-7000-8000-000000000002';

const settings = (over: Partial<SponsorSettings> = {}): SponsorSettings => ({
  enabled: true,
  placements: { home_banner: true, title_card: true, player_after: true, player_before: true },
  caps: { home_banner: 2, title_card: 4, player_after: 1, player_before: 1 },
  rotation: 'even',
  label: 'sponsored',
  linkNewTab: true,
  homeAfterRow: 3,
  beforeSeconds: 5,
  ...over,
});

const candidate = (over: Partial<SponsorCandidate> = {}): SponsorCandidate => ({
  sponsorId: '0198c000-0000-7000-8000-0000000000a1',
  sponsorName: 'Acme',
  status: 'active',
  startsAt: null,
  endsAt: null,
  creativeId: ID1,
  headline: 'Learn with us',
  body: 'Short text',
  ctaLabel: 'Learn more',
  destinationUrl: 'https://example.com/a',
  imageSquareUrl: 'https://cdn.example.com/s.webp',
  imageWideUrl: 'https://cdn.example.com/w.webp',
  altText: 'Logo',
  weight: 1,
  active: true,
  slots: ['home_banner', 'title_card', 'player_after', 'player_before'],
  ...over,
});

const input = (over: Partial<SelectInput> = {}): SelectInput => ({
  slot: 'home_banner',
  audience: 'general',
  viewer: 'account',
  siteGuestAudience: 'general',
  now: NOW,
  settings: settings(),
  candidates: [candidate()],
  caps: {},
  saveData: false,
  resumeSeconds: 0,
  ...over,
});

describe('selectSponsor kids guard', () => {
  it('returns a creative for a general audience', () => {
    expect(selectSponsor(input())?.creativeId).toBe(ID1);
  });
  it('returns null for kids audience for every slot', () => {
    for (const slot of ['home_banner', 'title_card', 'player_after', 'player_before'] as const) {
      expect(selectSponsor(input({ slot, audience: 'kids' }))).toBeNull();
    }
  });
  it('returns null for kids audience even when a sponsor is live and forced', () => {
    expect(selectSponsor(input({ audience: 'kids', candidates: [candidate({ weight: 10 })], settings: settings({ rotation: 'weighted' }) }))).toBeNull();
  });
  it('fails closed when the audience is unknown', () => {
    for (const audience of [undefined, null, '', 'adult', 'GENERAL', 7, {}]) {
      expect(selectSponsor(input({ audience: audience as never }))).toBeNull();
    }
    expect(isGeneralAudience('general')).toBe(true);
    expect(isGeneralAudience('kids')).toBe(false);
    expect(isGeneralAudience(undefined)).toBe(false);
  });
  it('returns null when site guest audience is kids', () => {
    expect(selectSponsor(input({ viewer: 'guest', siteGuestAudience: 'kids' }))).toBeNull();
    expect(selectSponsor(input({ viewer: 'guest', siteGuestAudience: 'general' }))?.creativeId).toBe(ID1);
  });
  it('fails closed when the site guest audience is unknown for a guest', () => {
    expect(selectSponsor(input({ viewer: 'guest', siteGuestAudience: undefined as never }))).toBeNull();
  });
});

describe('selectSponsor switches and eligibility', () => {
  it('returns null when master switch is off', () => {
    expect(selectSponsor(input({ settings: settings({ enabled: false }) }))).toBeNull();
  });
  it('returns null when placement switch is off', () => {
    const s = settings({ placements: { home_banner: false, title_card: true, player_after: true, player_before: true } });
    expect(selectSponsor(input({ settings: s }))).toBeNull();
    expect(selectSponsor(input({ settings: s, slot: 'title_card' }))).not.toBeNull();
  });
  it('skips creatives not assigned to the slot', () => {
    expect(selectSponsor(input({ candidates: [candidate({ slots: ['title_card'] })] }))).toBeNull();
  });
  it('skips inactive creatives and sponsors that are not live', () => {
    expect(selectSponsor(input({ candidates: [candidate({ active: false })] }))).toBeNull();
    expect(selectSponsor(input({ candidates: [candidate({ status: 'draft' })] }))).toBeNull();
    expect(selectSponsor(input({ candidates: [candidate({ status: 'paused' })] }))).toBeNull();
    expect(selectSponsor(input({ candidates: [candidate({ endsAt: new Date('2026-12-09T00:00:00Z') })] }))).toBeNull();
    expect(selectSponsor(input({ candidates: [candidate({ startsAt: new Date('2026-12-11T00:00:00Z') })] }))).toBeNull();
  });
  it('never returns a creative with a non https destination', () => {
    for (const url of ['http://example.com', 'javascript:alert(1)', '/relative', 'data:text/html,x']) {
      expect(selectSponsor(input({ candidates: [candidate({ destinationUrl: url })] }))).toBeNull();
    }
  });
  it('skips creatives at their daily cap', () => {
    const day = Math.floor((NOW.getTime() + 3_600_000) / 86_400_000);
    let caps = recordImpression({}, ID1, 'home_banner', day);
    caps = recordImpression(caps, ID1, 'home_banner', day);
    expect(selectSponsor(input({ caps }))).toBeNull();
    const second = candidate({ creativeId: ID2 });
    expect(selectSponsor(input({ caps, candidates: [candidate(), second] }))?.creativeId).toBe(ID2);
  });
  it('a cap on one slot does not block the same creative on another slot', () => {
    const day = Math.floor((NOW.getTime() + 3_600_000) / 86_400_000);
    let caps = {};
    for (let i = 0; i < 2; i += 1) caps = recordImpression(caps, ID1, 'home_banner', day);
    expect(selectSponsor(input({ caps, slot: 'title_card' }))?.creativeId).toBe(ID1);
  });
});

describe('selectSponsor rotation', () => {
  const two = [candidate({ creativeId: ID1, weight: 3 }), candidate({ creativeId: ID2, weight: 1 })];
  const onDay = (n: number) => new Date(Date.UTC(2026, 11, 1 + n, 12));

  it('rotates evenly across eligible creatives by day', () => {
    const picks = [0, 1, 2, 3].map((n) => selectSponsor(input({ now: onDay(n), candidates: two }))?.creativeId);
    expect(picks.filter((p) => p === ID1)).toHaveLength(2);
    expect(picks.filter((p) => p === ID2)).toHaveLength(2);
    expect(picks[0]).not.toBe(picks[1]);
  });
  it('is stable within a day regardless of candidate order', () => {
    const a = selectSponsor(input({ candidates: two }))?.creativeId;
    const b = selectSponsor(input({ candidates: [...two].reverse() }))?.creativeId;
    expect(a).toBe(b);
  });
  it('weighted rotation respects weights', () => {
    const s = settings({ rotation: 'weighted' });
    const picks = [0, 1, 2, 3].map((n) => selectSponsor(input({ now: onDay(n), candidates: two, settings: s }))?.creativeId);
    expect(picks.filter((p) => p === ID1)).toHaveLength(3);
    expect(picks.filter((p) => p === ID2)).toHaveLength(1);
  });
  it('one creative always shows', () => {
    for (let n = 0; n < 5; n += 1) expect(selectSponsor(input({ now: onDay(n) }))?.creativeId).toBe(ID1);
  });
});

describe('selectSponsor presentation and data saver', () => {
  it('builds the click link on our own origin from the creative id', () => {
    const picked = selectSponsor(input());
    expect(picked?.href).toBe(`/s/${ID1}`);
    expect(picked).not.toHaveProperty('destinationUrl');
  });
  it('text card when saveData is on and image exists', () => {
    const picked = selectSponsor(input({ saveData: true }));
    expect(picked?.textOnly).toBe(true);
    expect(picked?.imageUrl).toBeNull();
    expect(selectSponsor(input())?.textOnly).toBe(false);
    expect(selectSponsor(input())?.imageUrl).toBe('https://cdn.example.com/s.webp');
  });
  it('a creative without an image is a text card', () => {
    const picked = selectSponsor(input({ candidates: [candidate({ imageSquareUrl: null, imageWideUrl: null })] }));
    expect(picked?.textOnly).toBe(true);
  });
  it('carries the label key and the link target setting', () => {
    const picked = selectSponsor(input({ settings: settings({ label: 'sponsor_message', linkNewTab: false }) }));
    expect(picked?.label).toBe('sponsor_message');
    expect(picked?.newTab).toBe(false);
  });
});

describe('selectSponsor player before slot', () => {
  it('player_before returns null when saveData is on', () => {
    expect(selectSponsor(input({ slot: 'player_before', saveData: true }))).toBeNull();
  });
  it('player_before returns null when resume position is above zero', () => {
    expect(selectSponsor(input({ slot: 'player_before', resumeSeconds: 12 }))).toBeNull();
    expect(selectSponsor(input({ slot: 'player_before', resumeSeconds: 0 }))?.creativeId).toBe(ID1);
  });
  it('player_after is still offered under saveData as a text card', () => {
    const picked = selectSponsor(input({ slot: 'player_after', saveData: true }));
    expect(picked?.textOnly).toBe(true);
  });
  it('resume position does not affect other slots', () => {
    expect(selectSponsor(input({ slot: 'title_card', resumeSeconds: 99 }))?.creativeId).toBe(ID1);
  });
});
