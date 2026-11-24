import { describe, expect, it } from 'vitest';
import { adminStatusOf, canPublish, publishChecklist, videoStub } from './video-rules';

const base = videoStub({
  id: 'v1',
  title: 'Why the Sky Is Blue',
  description: 'A short look at light and the sky.',
  status: 'ready',
  captionState: 'approved',
  posterId: 'p1',
  suitability: 'everyone',
});

describe('adminStatusOf', () => {
  it('maps pipeline and publish state to the eight admin statuses', () => {
    expect(adminStatusOf({ ...base, publishState: 'published' })).toBe('published');
    expect(adminStatusOf({ ...base, publishState: 'scheduled' })).toBe('scheduled');
    expect(adminStatusOf(base)).toBe('ready');
    expect(adminStatusOf({ ...base, publishState: 'unpublished' })).toBe('ready');
    expect(adminStatusOf({ ...base, captionState: 'needs_review' })).toBe('needs_captions');
    expect(adminStatusOf({ ...base, captionState: 'none' })).toBe('needs_captions');
    expect(adminStatusOf({ ...base, status: 'uploading' })).toBe('uploading');
    for (const status of ['uploaded', 'validating', 'encoding'] as const) {
      expect(adminStatusOf({ ...base, status })).toBe('processing');
    }
    expect(adminStatusOf({ ...base, status: 'failed' })).toBe('failed');
  });

  it('shows draft for a new video with no details yet', () => {
    expect(adminStatusOf({ ...base, title: '', status: 'ready', captionState: 'none' })).toBe(
      'draft',
    );
  });

  it('failure wins over publish state', () => {
    expect(adminStatusOf({ ...base, status: 'failed', publishState: 'published' })).toBe('failed');
  });
});

describe('publishChecklist and canPublish', () => {
  it('passes when everything is done', () => {
    const items = publishChecklist(base);
    expect(items.map((i) => i.key)).toEqual([
      'uploaded',
      'encoded',
      'poster',
      'captions',
      'details',
      'maturity',
    ]);
    expect(items.every((i) => i.done)).toBe(true);
    expect(canPublish(base, { requireApprovedCaptions: true })).toEqual({ ok: true, blockers: [] });
  });

  it('names what is missing in plain words', () => {
    const video = {
      ...base,
      posterId: null,
      captionState: 'needs_review' as const,
      suitability: null,
      maturityRank: null,
    };
    const result = canPublish(video, { requireApprovedCaptions: true });
    expect(result.ok).toBe(false);
    expect(result.blockers.map((b) => b.key)).toEqual(['poster', 'captions', 'maturity']);
    expect(result.blockers[2]!.detail).toBe('Choose a maturity rating.');
    expect(result.blockers[1]!.detail).toBe('Captions need review before this can go live.');
  });

  it('can relax the captions rule from settings', () => {
    const video = { ...base, captionState: 'none' as const };
    expect(canPublish(video, { requireApprovedCaptions: false }).ok).toBe(true);
  });

  it('an approved override reason satisfies the captions step', () => {
    const video = { ...base, captionState: 'none' as const, captionOverrideReason: 'Music only' };
    expect(canPublish(video, { requireApprovedCaptions: true }).ok).toBe(true);
  });

  it('blocks while the video is still processing', () => {
    const result = canPublish({ ...base, status: 'encoding' }, { requireApprovedCaptions: true });
    expect(result.ok).toBe(false);
    expect(result.blockers[0]!.key).toBe('encoded');
  });

  it('requires a title and a description of at least 20 characters', () => {
    const result = canPublish({ ...base, description: 'Short' }, { requireApprovedCaptions: true });
    expect(result.blockers.map((b) => b.key)).toEqual(['details']);
  });
});

describe('maturity on the checklist (M44-S13)', () => {
  it('counts a rank of 0 as set, and derives one from a legacy suitability', () => {
    const rated = { ...base, suitability: null, maturityRank: 0 };
    expect(canPublish(rated).ok).toBe(true);
    const legacy = { ...base, suitability: 'older' as const, maturityRank: undefined };
    expect(canPublish(legacy).ok).toBe(true);
    expect(canPublish({ ...base, suitability: null, maturityRank: undefined }).ok).toBe(false);
  });
});
