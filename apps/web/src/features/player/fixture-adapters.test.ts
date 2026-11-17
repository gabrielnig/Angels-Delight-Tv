import { describe, expect, it } from 'vitest';
import {
  createFixtureSessionProvider,
  createLocalProgressSink,
  readLocalProgress,
} from './fixture-adapters';
import type { KeyValueStore } from './preferences';

function memory(): KeyValueStore {
  const data: Record<string, string> = {};
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe('createFixtureSessionProvider', () => {
  const provider = createFixtureSessionProvider('https://app.test');

  it('serves the generated sample for normal videos', async () => {
    const s = await provider.createSession('v-plants');
    expect(s.masterUrl).toBe('https://app.test/fixtures/hls/plain/master.m3u8');
    expect(s.token).toBe('fixture-token');
    expect(s.expiresAt).toBeGreaterThan(Date.now() + 29 * 60_000);
  });

  it('serves the AES-128 sample for the encrypted fixture', async () => {
    expect((await provider.createSession('v-encrypted')).masterUrl).toBe(
      'https://app.test/fixtures/hls/enc/master.m3u8',
    );
  });
});

describe('local progress sink', () => {
  it('keeps the newest write per profile and video', async () => {
    const store = memory();
    const sink = createLocalProgressSink(store);
    const base = { videoId: 'v1', profileId: 'p1', durationSeconds: 300, ended: false };
    await sink.save({ ...base, positionSeconds: 20 });
    await sink.save({ ...base, positionSeconds: 45 });
    expect(readLocalProgress(store, 'p1', 'v1')).toEqual({ positionSeconds: 45, finished: false });
    expect(readLocalProgress(store, 'p2', 'v1')).toBeNull();
  });

  it('marks finished writes', async () => {
    const store = memory();
    await createLocalProgressSink(store).save({
      videoId: 'v1',
      profileId: 'p1',
      positionSeconds: 300,
      durationSeconds: 300,
      ended: true,
    });
    expect(readLocalProgress(store, 'p1', 'v1')).toEqual({ positionSeconds: 300, finished: true });
  });

  it('returns null for corrupt entries', () => {
    const store = memory();
    store.setItem('ad.progress.p1.v1', 'oops');
    expect(readLocalProgress(store, 'p1', 'v1')).toBeNull();
  });
});
