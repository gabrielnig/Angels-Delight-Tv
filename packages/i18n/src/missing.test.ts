import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MissingKeySink, isBotOrPrefetch } from './missing';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const make = (over: Partial<ConstructorParameters<typeof MissingKeySink>[0]> = {}) => {
  const flush = vi.fn(async () => {});
  const sink = new MissingKeySink({ flush, enabled: () => ['en', 'yo'], ...over });
  return { sink, flush };
};

describe('MissingKeySink', () => {
  it('batches hits and flushes once a minute per process', async () => {
    const { sink, flush } = make();
    sink.record('yo', 'nav.home');
    sink.record('yo', 'nav.home');
    sink.record('yo', 'nav.browse');
    expect(flush).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([
      { locale: 'yo', key: 'nav.home', hits: 2 },
      { locale: 'yo', key: 'nav.browse', hits: 1 },
    ]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(flush).toHaveBeenCalledTimes(1);
  });
  it('a sink failure never breaks rendering', async () => {
    const { sink } = make({ flush: async () => { throw new Error('db down'); } });
    expect(() => sink.record('yo', 'nav.home')).not.toThrow();
    await expect(sink.flushNow()).resolves.toBeUndefined();
  });
  it('only enabled non default locales are recorded', async () => {
    const { sink, flush } = make();
    sink.record('en', 'nav.home');
    sink.record('ha', 'nav.home');
    await sink.flushNow();
    expect(flush).not.toHaveBeenCalled();
  });
  it('bots and prefetch requests are not counted', async () => {
    const { sink, flush } = make();
    sink.record('yo', 'nav.home', { userAgent: 'Googlebot/2.1' });
    sink.record('yo', 'nav.home', { prefetch: true });
    expect(isBotOrPrefetch({ userAgent: 'Mozilla/5.0 (Linux; Android 13)' })).toBe(false);
    await sink.flushNow();
    expect(flush).not.toHaveBeenCalled();
  });
  it('keeps at most 500 pending keys so memory stays bounded', async () => {
    const { sink, flush } = make();
    for (let i = 0; i < 600; i++) sink.record('yo', `nav.key${i}`);
    await sink.flushNow();
    expect((flush.mock.calls[0] as unknown as [unknown[]])[0]).toHaveLength(500);
  });
  it('a failed flush puts the hits back for the next minute', async () => {
    let fail = true;
    const flush = vi.fn(async () => { if (fail) throw new Error('x'); });
    const { sink } = make({ flush });
    sink.record('yo', 'nav.home');
    await sink.flushNow();
    fail = false;
    await sink.flushNow();
    expect(flush).toHaveBeenCalledTimes(2);
    expect(flush).toHaveBeenLastCalledWith([{ locale: 'yo', key: 'nav.home', hits: 1 }]);
  });
});
