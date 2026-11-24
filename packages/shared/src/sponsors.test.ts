import { describe, expect, it } from 'vitest';
import {
  SPONSOR_SLOTS,
  SPONSOR_STATUSES,
  SPONSOR_STATUS_FIXTURES,
  deriveSponsorStatus,
  isSponsorSlot,
} from './sponsors';

describe('sponsor vocabulary', () => {
  it('has four slots and four stored statuses', () => {
    expect(SPONSOR_SLOTS).toEqual(['home_banner', 'title_card', 'player_after', 'player_before']);
    expect(SPONSOR_STATUSES).toEqual(['draft', 'active', 'paused', 'archived']);
    expect(isSponsorSlot('title_card')).toBe(true);
    expect(isSponsorSlot('footer')).toBe(false);
  });
});

describe('deriveSponsorStatus', () => {
  const at = new Date('2026-12-15T12:00:00Z');
  const starts = new Date('2026-12-01T00:00:00Z');
  const ends = new Date('2026-12-31T22:59:59Z');

  it('draft stays draft inside the window', () => {
    expect(deriveSponsorStatus({ status: 'draft', startsAt: starts, endsAt: ends }, at)).toBe('draft');
  });
  it('is scheduled before the start', () => {
    expect(deriveSponsorStatus({ status: 'active', startsAt: starts, endsAt: ends }, new Date('2026-11-30T12:00:00Z'))).toBe('scheduled');
  });
  it('is live inside the window', () => {
    expect(deriveSponsorStatus({ status: 'active', startsAt: starts, endsAt: ends }, at)).toBe('live');
  });
  it('is ended after the end', () => {
    expect(deriveSponsorStatus({ status: 'active', startsAt: starts, endsAt: ends }, new Date('2027-01-01T00:00:00Z'))).toBe('ended');
  });
  it('paused wins over live', () => {
    expect(deriveSponsorStatus({ status: 'paused', startsAt: starts, endsAt: ends }, at)).toBe('paused');
  });
  it('archived wins over everything', () => {
    expect(deriveSponsorStatus({ status: 'archived', startsAt: null, endsAt: null }, at)).toBe('archived');
  });
  it('no dates means live until paused', () => {
    expect(deriveSponsorStatus({ status: 'active', startsAt: null, endsAt: null }, at)).toBe('live');
  });
  it('start is inclusive and end is inclusive', () => {
    expect(deriveSponsorStatus({ status: 'active', startsAt: starts, endsAt: ends }, starts)).toBe('live');
    expect(deriveSponsorStatus({ status: 'active', startsAt: starts, endsAt: ends }, ends)).toBe('live');
    expect(deriveSponsorStatus({ status: 'active', startsAt: starts, endsAt: ends }, new Date(ends.getTime() + 1))).toBe('ended');
  });
  it('fixtures cover every derived state', () => {
    const states = new Set(SPONSOR_STATUS_FIXTURES.map((f) => f.expected));
    for (const state of ['draft', 'scheduled', 'live', 'paused', 'ended', 'archived']) {
      expect(states.has(state as never), state).toBe(true);
    }
    for (const f of SPONSOR_STATUS_FIXTURES) {
      expect(deriveSponsorStatus(f.sponsor, f.at), f.name).toBe(f.expected);
    }
  });
});
