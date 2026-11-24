import { describe, expect, it } from 'vitest';
import { deriveSponsorStatus, lagosDayEnd, lagosDayNumber, lagosDayStart } from './status';

describe('sponsor status', () => {
  const window = { startsAt: lagosDayStart('2026-12-01'), endsAt: lagosDayEnd('2026-12-31') };

  it('draft stays draft inside the window', () => {
    expect(deriveSponsorStatus({ status: 'draft', ...window }, new Date('2026-12-10T10:00:00Z'))).toBe('draft');
  });
  it('is scheduled before the start', () => {
    expect(deriveSponsorStatus({ status: 'active', ...window }, new Date('2026-11-30T22:59:59Z'))).toBe('scheduled');
  });
  it('is live inside the window', () => {
    expect(deriveSponsorStatus({ status: 'active', ...window }, new Date('2026-12-10T10:00:00Z'))).toBe('live');
  });
  it('is ended after the end', () => {
    expect(deriveSponsorStatus({ status: 'active', ...window }, new Date('2026-12-31T23:00:00Z'))).toBe('ended');
  });
  it('paused wins over live', () => {
    expect(deriveSponsorStatus({ status: 'paused', ...window }, new Date('2026-12-10T10:00:00Z'))).toBe('paused');
  });
});

describe('Lagos day boundaries', () => {
  it('window boundaries use Africa/Lagos midnight', () => {
    expect(lagosDayStart('2026-12-01').toISOString()).toBe('2026-11-30T23:00:00.000Z');
    expect(lagosDayEnd('2026-12-31').toISOString()).toBe('2026-12-31T22:59:59.000Z');
  });
  it('the end day is inclusive to 23:59:59 Lagos time', () => {
    const end = lagosDayEnd('2026-12-31');
    expect(deriveSponsorStatus({ status: 'active', startsAt: null, endsAt: end }, end)).toBe('live');
    expect(deriveSponsorStatus({ status: 'active', startsAt: null, endsAt: end }, new Date(end.getTime() + 1000))).toBe('ended');
  });
  it('rejects text that is not a calendar day', () => {
    expect(() => lagosDayStart('2026-13-01')).toThrow();
    expect(() => lagosDayEnd('tomorrow')).toThrow();
    expect(() => lagosDayStart('2026-02-30')).toThrow();
  });
  it('day numbers change at Lagos midnight', () => {
    const before = lagosDayNumber(new Date('2026-12-01T22:59:59Z'));
    const after = lagosDayNumber(new Date('2026-12-01T23:00:00Z'));
    expect(after).toBe(before + 1);
  });
});
