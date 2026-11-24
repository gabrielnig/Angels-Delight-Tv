import { describe, expect, it } from 'vitest';
import {
  applyCaptionsAvailability,
  daysLeftInTrash,
  purgeVideo,
  restoreVideo,
  retryEncode,
  schedulePublish,
  validateVideoPatch,
} from './video-commands';
import { seedStore } from './store';

const NOW = Date.parse('2026-11-17T09:00:00Z');
const rules = { requireApprovedCaptions: true };
const get = (store: ReturnType<typeof seedStore>, id: string) =>
  store.videos.find((v) => v.id === id)!;

describe('validateVideoPatch', () => {
  const categories = new Set(['cat_life']);
  it('accepts a good patch and trims', () => {
    expect(
      validateVideoPatch(
        { title: '  Hello  ', tags: ['a', 'b'], categoryIds: ['cat_life'] },
        categories,
      ),
    ).toEqual({
      ok: true,
      value: { title: 'Hello', tags: ['a', 'b'], categoryIds: ['cat_life'] },
    });
  });
  it('explains each problem in plain words', () => {
    const result = validateVideoPatch(
      { title: '', description: 'x'.repeat(501), tags: Array(11).fill('t'), categoryIds: ['nope'] },
      categories,
    );
    expect(result).toEqual({
      ok: false,
      errors: {
        title: 'Add a title.',
        description: 'Keep the description under 500 characters.',
        tags: 'Use at most 10 tags.',
        categoryIds: 'Pick categories from the list.',
      },
    });
  });
  it('checks the address is a plain slug and says how to fix it', () => {
    expect(validateVideoPatch({ slug: '  rivers-of-africa ' }, categories)).toEqual({
      ok: true,
      value: { slug: 'rivers-of-africa' },
    });
    for (const bad of ['', 'ab', 'Rivers Of Africa', 'a--b', '-lead', 'x'.repeat(121)]) {
      const result = validateVideoPatch({ slug: bad }, categories);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.slug).toMatch(/address/i);
    }
  });
  it('ignores fields it does not know (no mass assignment)', () => {
    const result = validateVideoPatch(
      { title: 'A', views: 99, status: 'ready' } as never,
      categories,
    );
    expect(result.ok && 'views' in result.value).toBe(false);
  });
});

describe('schedulePublish', () => {
  it('publishes now when everything passes', () => {
    const store = seedStore(NOW);
    const r = schedulePublish(get(store, 'vid_safe_online'), { mode: 'now' }, 'editor', rules, NOW);
    expect(r).toEqual({ ok: true });
    expect(get(store, 'vid_safe_online').publishState).toBe('published');
  });
  it('rejects a time in the past', () => {
    const store = seedStore(NOW);
    const r = schedulePublish(
      get(store, 'vid_safe_online'),
      { mode: 'schedule', at: new Date(NOW - 1000).toISOString() },
      'editor',
      rules,
      NOW,
    );
    expect(r).toEqual({ ok: false, error: 'Pick a time in the future.' });
  });
  it('schedules a future time', () => {
    const store = seedStore(NOW);
    const at = new Date(NOW + 3600_000).toISOString();
    schedulePublish(get(store, 'vid_safe_online'), { mode: 'schedule', at }, 'editor', rules, NOW);
    expect(get(store, 'vid_safe_online')).toMatchObject({
      publishState: 'scheduled',
      publishAt: at,
    });
  });
  it('blocks on missing checklist items', () => {
    const store = seedStore(NOW);
    const r = schedulePublish(get(store, 'vid_naira'), { mode: 'now' }, 'editor', rules, NOW);
    expect(r.ok).toBe(false);
  });
  it('lets only an admin override captions, with a reason', () => {
    const store = seedStore(NOW);
    const video = get(store, 'vid_plants');
    expect(
      schedulePublish(video, { mode: 'now', overrideReason: 'Music only' }, 'editor', rules, NOW)
        .ok,
    ).toBe(false);
    expect(
      schedulePublish(video, { mode: 'now', overrideReason: 'x' }, 'admin', rules, NOW),
    ).toEqual({ ok: false, error: 'Say why captions are being skipped, in a few words.' });
    expect(
      schedulePublish(video, { mode: 'now', overrideReason: 'Music only' }, 'admin', rules, NOW).ok,
    ).toBe(true);
    expect(video.captionOverrideReason).toBe('Music only');
  });
});

describe('trash', () => {
  it('counts days left of the 30 day grace', () => {
    expect(daysLeftInTrash(new Date(NOW - 5 * 86_400_000).toISOString(), NOW)).toBe(25);
    expect(daysLeftInTrash(new Date(NOW - 40 * 86_400_000).toISOString(), NOW)).toBe(0);
  });
  it('restores and purges', () => {
    const store = seedStore(NOW);
    expect(restoreVideo(store.videos, 'vid_old_intro', 'editor')).toEqual({ ok: true });
    expect(get(store, 'vid_old_intro').deletedAt).toBeNull();
    expect(purgeVideo(store.videos, 'vid_test_clip', 'editor')).toEqual({
      ok: false,
      error: 'Only an admin can delete forever.',
    });
    expect(purgeVideo(store.videos, 'vid_test_clip', 'admin')).toEqual({ ok: true });
    expect(store.videos.find((v) => v.id === 'vid_test_clip')).toBeUndefined();
    expect(purgeVideo(store.videos, 'vid_sky', 'admin').ok).toBe(false);
  });
});

describe('retryEncode', () => {
  it('moves a failed video back to encoding', () => {
    const store = seedStore(NOW);
    expect(retryEncode(get(store, 'vid_solar'), NOW)).toEqual({ ok: true });
    expect(get(store, 'vid_solar')).toMatchObject({
      status: 'encoding',
      failure: null,
      progress: 0,
    });
    expect(retryEncode(get(store, 'vid_sky'), NOW).ok).toBe(false);
  });
});

describe('applyCaptionsAvailability (L3-05)', () => {
  const video = () => ({ captionsEnabled: null, captionsOffReason: null }) as { captionsEnabled: boolean | null; captionsOffReason: string | null; updatedAt: string };

  it('an editor cannot change availability', () => {
    expect(applyCaptionsAvailability(video() as never, 'editor', true)).toMatchObject({ ok: false });
  });

  it('turning off without a reason is refused', () => {
    const v = video();
    expect(applyCaptionsAvailability(v as never, 'admin', false, 'abc')).toMatchObject({ ok: false });
    expect(v.captionsEnabled).toBeNull();
  });

  it('off with a reason stores it, and back to default clears it', () => {
    const v = video();
    expect(applyCaptionsAvailability(v as never, 'admin', false, ' Sign language video ')).toEqual({ ok: true });
    expect(v).toMatchObject({ captionsEnabled: false, captionsOffReason: 'Sign language video' });
    applyCaptionsAvailability(v as never, 'admin', null);
    expect(v).toMatchObject({ captionsEnabled: null, captionsOffReason: null });
  });
});
