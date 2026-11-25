import { afterEach, describe, expect, it } from 'vitest';
import { getStore } from '../store';
import { DEMO_NOW_ISO } from './dataset';
import { kbDemoAllowed, resetDemoStore } from './reset';

afterEach(() => {
  delete process.env.KB_DEMO;
});

describe('kbDemoAllowed', () => {
  it('needs KB_DEMO=on, fixture data and not production', () => {
    expect(kbDemoAllowed({ KB_DEMO: 'on', ADMIN_DATA: 'fixture', NODE_ENV: 'development' })).toBe(
      true,
    );
    expect(kbDemoAllowed({ ADMIN_DATA: 'fixture', NODE_ENV: 'development' })).toBe(false);
    expect(kbDemoAllowed({ KB_DEMO: 'on', ADMIN_DATA: 'real', NODE_ENV: 'development' })).toBe(
      false,
    );
    expect(kbDemoAllowed({ KB_DEMO: 'on', ADMIN_DATA: 'fixture', NODE_ENV: 'production' })).toBe(
      false,
    );
  });
});

describe('resetDemoStore', () => {
  it('discards changes and returns the same state each time', () => {
    resetDemoStore();
    const first = structuredClone(getStore());
    getStore().videos[0]!.title = 'Changed by an episode';
    getStore().categories.pop();
    resetDemoStore();
    expect(getStore()).toEqual(first);
  });

  it('seeds from the pinned clock and returns it', () => {
    const { now } = resetDemoStore();
    expect(now).toBe(Date.parse(DEMO_NOW_ISO));
    expect(getStore().videos.find((v) => v.id === 'vid_demo_uploading')).toBeDefined();
  });
});

describe('resetDemoStore clears the other fixture state too', () => {
  const holder = globalThis as unknown as Record<symbol, unknown>;

  it.each(['ad.admin.fixture.markers', 'ad.admin.fixture.auth', 'ad.theme.runtime'])(
    'drops the held state %s so the next call builds it fresh',
    (key) => {
      holder[Symbol.for(key)] = { dirty: true };
      resetDemoStore();
      expect(holder[Symbol.for(key)]).toBeUndefined();
    },
  );
});
