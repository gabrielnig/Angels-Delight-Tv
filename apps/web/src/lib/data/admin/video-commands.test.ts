import { describe, expect, it } from 'vitest';
import {
  applyCaptionsAvailability,
  daysLeftInTrash,
  purgeMany,
  purgeVideo,
  queuePreviewBackfill,
  restoreMany,
  restoreVideo,
  retryEncode,
  retryEncodeMany,
  retryPreview,
  schedulePublish,
  setPreviewMode,
  validateVideoPatch,
} from './video-commands';
import { seedStore } from './store';

const NOW = Date.parse('2026-11-17T09:00:00Z');
const rules = { requireApprovedCaptions: true };
const get = (store: ReturnType<typeof seedStore>, id: string) =>
  store.videos.find((v) => v.id === id)!;

describe('validateVideoPatch maturityRank', () => {
  const categories = new Set<string>();
  it('accepts 0 to 4', () => {
    for (const rank of [0, 1, 2, 3, 4])
      expect(validateVideoPatch({ maturityRank: rank }, categories)).toEqual({
        ok: true,
        value: { maturityRank: rank },
      });
  });
  it('refuses anything else', () => {
    for (const rank of [-1, 5, 1.5, Number.NaN])
      expect(validateVideoPatch({ maturityRank: rank }, categories)).toEqual({
        ok: false,
        errors: { maturityRank: 'Choose one of the five ratings.' },
      });
  });
});

describe('validateVideoPatch language (M46)', () => {
  it('accepts a locale code or auto and refuses the rest', () => {
    for (const code of ['en', 'yo', 'ig', 'ha', 'pcm', 'auto'])
      expect(validateVideoPatch({ language: code }, new Set())).toEqual({ ok: true, value: { language: code } });
    expect(validateVideoPatch({ language: 'fr' }, new Set())).toEqual({
      ok: false,
      errors: { language: 'Choose a language from the list.' },
    });
  });
});

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

describe('restoreMany and purgeMany (L3-10)', () => {
  const trashed = () => {
    const store = seedStore(NOW);
    const ids = store.videos.filter((v) => v.deletedAt !== null).map((v) => v.id);
    return { store, ids };
  };

  it('restoreMany returns each to Draft and fails ids that are not in Trash', () => {
    const { store, ids } = trashed();
    const out = restoreMany(store.videos, [...ids, 'vid_sky'], 'editor');
    expect(out.succeeded).toEqual(ids);
    expect(out.failed).toEqual([{ id: 'vid_sky', reason: 'That video is not in Trash.', retryable: false }]);
    for (const id of ids) expect(get(store, id).deletedAt).toBeNull();
    for (const id of ids) expect(get(store, id).publishState).toBe('draft');
  });

  it('purgeMany refuses below admin for every id', () => {
    const { store, ids } = trashed();
    const out = purgeMany(store.videos, ids, 'editor');
    expect(out.succeeded).toEqual([]);
    expect(out.failed.map((f) => f.reason)).toEqual(ids.map(() => 'Only an admin can delete forever.'));
    expect(store.videos.filter((v) => ids.includes(v.id))).toHaveLength(ids.length);
  });

  it('purgeMany leaves videos not in Trash as failed with a reason and removes the rest', () => {
    const { store, ids } = trashed();
    const out = purgeMany(store.videos, [...ids, 'vid_sky'], 'admin');
    expect(out.succeeded).toEqual(ids);
    expect(out.failed).toEqual([{ id: 'vid_sky', reason: 'That video is not in Trash.', retryable: false }]);
    expect(store.videos.some((v) => ids.includes(v.id))).toBe(false);
    expect(get(store, 'vid_sky')).toBeTruthy();
  });
});

describe('retryEncodeMany (L3-09)', () => {
  const failed = (id: string, updatedAt: string, over: Record<string, unknown> = {}) =>
    ({ id, status: 'failed', failure: { reason: 'x' }, progress: 50, updatedAt, deletedAt: null, ...over }) as never;

  it('retries failed rows oldest failure first and skips the others with a reason', () => {
    const videos = [
      failed('new', '2026-11-17T10:00:00Z'),
      failed('old', '2026-11-15T10:00:00Z'),
      { id: 'ok', status: 'ready', deletedAt: null, updatedAt: '2026-11-16T10:00:00Z' } as never,
    ];
    const out = retryEncodeMany(videos, ['new', 'old', 'ok', 'missing'], NOW);
    expect(out.succeeded).toEqual(['old', 'new']);
    expect(out.skipped).toEqual([{ id: 'ok', reason: 'Not failed any more.' }]);
    expect(out.failed).toEqual([{ id: 'missing', reason: 'That video no longer exists.', retryable: false }]);
    expect(videos.map((v) => (v as unknown as { status: string }).status)).toEqual(['encoding', 'encoding', 'ready']);
  });

  it('skips a row whose original file was removed', () => {
    const videos = [failed('gone', '2026-11-15T10:00:00Z')];
    const out = retryEncodeMany(videos, ['gone'], NOW, (id) => id !== 'gone');
    expect(out.succeeded).toEqual([]);
    expect(out.skipped).toEqual([
      { id: 'gone', reason: 'The original file was removed. Replace the file instead.' },
    ]);
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

describe('hero preview clip commands (M41-S10)', () => {
  const video = () => {
    const v = structuredClone(get(seedStore(NOW), seedStore(NOW).videos[0]!.id));
    v.durationSeconds = 90;
    v.preview = { state: 'ready', mode: 'auto', startMs: null, note: null };
    return v;
  };

  it('turning it off keeps the state and hides the clip', () => {
    const v = video();
    expect(setPreviewMode(v, { mode: 'off' })).toEqual({ ok: true });
    expect(v.preview).toMatchObject({ mode: 'off', state: 'ready' });
  });

  it('picked needs a start in 100 ms steps with the clip length left, and queues a recut', () => {
    const v = video();
    expect(setPreviewMode(v, { mode: 'picked', startMs: 12_350 }).ok).toBe(false);
    expect(setPreviewMode(v, { mode: 'picked', startMs: 85_000 })).toEqual({
      ok: false,
      error: 'Pick a start between 0:00 and 1:10 so the clip has 20 seconds to play',
    });
    expect(setPreviewMode(v, { mode: 'picked' }).ok).toBe(false);
    expect(setPreviewMode(v, { mode: 'picked', startMs: 12_300 })).toEqual({ ok: true });
    expect(v.preview).toEqual({ state: 'queued', mode: 'picked', startMs: 12_300, note: null });
  });

  it('automatic clears the start and queues a recut', () => {
    const v = video();
    v.preview = { state: 'failed', mode: 'picked', startMs: 5000, note: 'x' };
    expect(setPreviewMode(v, { mode: 'auto' })).toEqual({ ok: true });
    expect(v.preview).toEqual({ state: 'queued', mode: 'auto', startMs: null, note: null });
  });

  it('retry queues again unless the clip is off', () => {
    const v = video();
    v.preview = { state: 'failed', mode: 'auto', startMs: null, note: 'The clip came out too large' };
    expect(retryPreview(v)).toEqual({ ok: true });
    expect(v.preview).toMatchObject({ state: 'queued', note: null });
    v.preview.mode = 'off';
    expect(retryPreview(v)).toEqual({ ok: false, error: 'Turn the preview clip on first' });
  });
});

describe('queuePreviewBackfill (Generate previews for all videos)', () => {
  const make = (over: Partial<ReturnType<typeof base>> = {}) => ({ ...base(), ...over });
  const base = () => {
    const v = structuredClone(get(seedStore(NOW), seedStore(NOW).videos[0]!.id));
    v.status = 'ready';
    v.publishState = 'published';
    v.deletedAt = null;
    v.preview = { state: 'none', mode: 'auto', startMs: null, note: null };
    return v;
  };

  it('queues published ready videos with no clip, a failed or a skipped one', () => {
    const none = make();
    const failed = make({ preview: { state: 'failed', mode: 'auto', startMs: null, note: 'x' } });
    const skipped = make({ preview: { state: 'skipped', mode: 'auto', startMs: null, note: 'y' } });
    expect(queuePreviewBackfill([none, failed, skipped])).toEqual({ ok: true, queued: 3, current: 0 });
    for (const v of [none, failed, skipped]) expect(v.preview).toMatchObject({ state: 'queued', note: null });
  });

  it('leaves out off, unpublished, deleted, ready and queued videos, and a second press queues nothing', () => {
    const off = make({ preview: { state: 'none', mode: 'off', startMs: null, note: null } });
    const draft = make({ publishState: 'draft' });
    const gone = make({ deletedAt: new Date(NOW).toISOString() });
    const done = make({ preview: { state: 'ready', mode: 'auto', startMs: null, note: null } });
    const waiting = make({ preview: { state: 'queued', mode: 'auto', startMs: null, note: null } });
    const fresh = make();
    const all = [off, draft, gone, done, waiting, fresh];
    expect(queuePreviewBackfill(all)).toEqual({ ok: true, queued: 1, current: 2 });
    expect(queuePreviewBackfill(all)).toEqual({ ok: true, queued: 0, current: 3 });
  });
});
