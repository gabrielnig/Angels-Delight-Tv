import { describe, expect, it } from 'vitest';
import {
  approveTrack,
  ensureTrack,
  regenerateTrack,
  replaceCues,
  saveCues,
  sampleCues,
} from './caption-commands';
import { seedStore } from './store';

const NOW = Date.parse('2026-11-17T09:00:00Z');
const setup = () => {
  const store = seedStore(NOW);
  const video = (id: string) => store.videos.find((v) => v.id === id)!;
  return { store, video };
};

describe('sampleCues', () => {
  it('makes in order, non overlapping cues that fit inside the video', () => {
    const cues = sampleCues('seed', 84, 352);
    expect(cues).toHaveLength(84);
    for (let i = 1; i < cues.length; i++)
      expect(cues[i]!.start).toBeGreaterThanOrEqual(cues[i - 1]!.end);
    expect(cues.at(-1)!.end).toBeLessThanOrEqual(352_000);
    expect(new Set(cues.map((c) => c.id)).size).toBe(84);
  });
});

describe('ensureTrack', () => {
  it('builds a needs review track with the cue count the video claims', () => {
    const { store, video } = setup();
    const track = ensureTrack(store, video('vid_plants'), NOW)!;
    expect(track.state).toBe('needs_review');
    expect(track.cues).toHaveLength(84);
    expect(ensureTrack(store, video('vid_plants'), NOW)).toBe(track);
  });
  it('builds approved, generating and failed tracks and nothing for no captions', () => {
    const { store, video } = setup();
    expect(ensureTrack(store, video('vid_sky'), NOW)).toMatchObject({
      state: 'approved',
      approvedBy: 'Tunde Bakare',
    });
    expect(ensureTrack(store, video('vid_rivers'), NOW)!.progress).toMatchObject({
      step: 3,
      of: 5,
    });
    expect(ensureTrack(store, video('vid_naira'), NOW)).toBeNull();
    video('vid_solar').captionState = 'failed';
    expect(ensureTrack(store, video('vid_solar'), NOW)!.failure).toMatch(/too quiet/);
  });
});

describe('saveCues', () => {
  it('stores edits and keeps an approved track approved while counting changes', () => {
    const { store, video } = setup();
    const track = ensureTrack(store, video('vid_sky'), NOW)!;
    const edited = track.cues.map((c, i) => (i < 2 ? { ...c, text: `${c.text} again` } : c));
    const result = saveCues(store, video('vid_sky'), edited, 'editor', 'Ngozi Eze', NOW);
    expect(result).toEqual({ ok: true, changesSinceApproval: 2 });
    expect(track.state).toBe('approved');
    expect(track.updatedBy).toBe('Ngozi Eze');
  });
  it('rejects bad input and viewers', () => {
    const { store, video } = setup();
    ensureTrack(store, video('vid_plants'), NOW);
    expect(saveCues(store, video('vid_plants'), [], 'editor', 'N', NOW).ok).toBe(false);
    expect(
      saveCues(
        store,
        video('vid_plants'),
        [{ id: 'a', start: 0, end: 1, text: 'x'.repeat(501) }],
        'editor',
        'N',
        NOW,
      ).ok,
    ).toBe(false);
    expect(
      saveCues(
        store,
        video('vid_plants'),
        [{ id: 'a', start: 0, end: 1, text: 'ok' }],
        'viewer',
        'N',
        NOW,
      ),
    ).toEqual({ ok: false, error: 'You do not have permission to edit captions.' });
  });
});

describe('approveTrack', () => {
  it('approves, records who and when, snapshots the cues and updates the video', () => {
    const { store, video } = setup();
    const track = ensureTrack(store, video('vid_plants'), NOW)!;
    expect(approveTrack(store, video('vid_plants'), 'editor', 'Ngozi Eze', NOW)).toEqual({
      ok: true,
    });
    expect(track).toMatchObject({ state: 'approved', approvedBy: 'Ngozi Eze' });
    expect(track.approvedCues).toEqual(track.cues);
    expect(video('vid_plants').captionState).toBe('approved');
    expect(video('vid_plants').captionOverrideReason).toBeNull();
  });
  it('refuses a viewer and a track that is still generating', () => {
    const { store, video } = setup();
    ensureTrack(store, video('vid_plants'), NOW);
    expect(approveTrack(store, video('vid_plants'), 'viewer', 'V', NOW).ok).toBe(false);
    ensureTrack(store, video('vid_rivers'), NOW);
    expect(approveTrack(store, video('vid_rivers'), 'editor', 'N', NOW)).toEqual({
      ok: false,
      error: 'Captions are still being made.',
    });
  });
});

describe('regenerate and replace', () => {
  it('regenerate puts the track back to generating', () => {
    const { store, video } = setup();
    ensureTrack(store, video('vid_plants'), NOW);
    expect(regenerateTrack(store, video('vid_plants'), 'editor', NOW)).toEqual({ ok: true });
    expect(video('vid_plants').captionState).toBe('generating');
  });
  it('an uploaded file replaces the cues and needs review again', () => {
    const { store, video } = setup();
    ensureTrack(store, video('vid_sky'), NOW);
    replaceCues(
      store,
      video('vid_sky'),
      [{ id: 'a', start: 0, end: 1000, text: 'Hi' }],
      'editor',
      'N',
      NOW,
    );
    expect(video('vid_sky').captionState).toBe('needs_review');
    expect(store.captions.vid_sky!.cues).toHaveLength(1);
    expect(store.captions.vid_sky!.source).toBe('manual');
  });
});
