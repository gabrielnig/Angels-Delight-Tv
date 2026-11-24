import { describe, expect, it, vi } from 'vitest';
import { PlayerController, type PlayerControllerOptions } from './controller';
import type { CaptionTrack } from './types';
import { FakeEngine, FakeMedia, FakeNetwork, FakePage } from './testing/fakes';

const track = (language: string, label: string): CaptionTrack => ({
  id: language,
  language,
  label,
  src: `/c/${language}.vtt`,
  status: 'approved',
});
const en = track('en', 'English');
const yo = track('yo', 'Yorùbá');
const ha = track('ha', 'Hausa');

function make(extra: Partial<PlayerControllerOptions> = {}) {
  const c = new PlayerController({
    media: new FakeMedia(),
    engine: new FakeEngine(),
    tokens: { token: 't', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
    network: new FakeNetwork(),
    page: new FakePage(),
    ...extra,
  });
  return c;
}
const on = { captionsOn: true } as const;

describe('default caption track (M46-S14)', () => {
  it('is the profile caption language when listed', () => {
    const c = make({ captions: [en, yo, ha], preferences: { ...on, captionLanguage: 'ha' }, uiLanguage: 'yo' });
    expect(c.getState().captions.active).toBe('ha');
  });

  it('else the interface language when listed', () => {
    const c = make({ captions: [en, yo, ha], preferences: { ...on, captionLanguage: 'ig' }, uiLanguage: 'yo' });
    expect(c.getState().captions.active).toBe('yo');
  });

  it('else English, never the first track by position', () => {
    const c = make({ captions: [yo, ha, en], preferences: { ...on, captionLanguage: 'ig' }, uiLanguage: 'pcm' });
    expect(c.getState().captions.active).toBe('en');
  });

  it('picks nothing when several tracks exist and none matches, so the viewer chooses', () => {
    const c = make({ captions: [yo, ha], preferences: { ...on, captionLanguage: 'en' }, uiLanguage: 'en' });
    expect(c.getState().captions.active).toBeNull();
    expect(c.getState().captions.available).toBe(true);
  });

  it('uses the only track when there is one, whatever its language', () => {
    const c = make({ captions: [yo], preferences: { ...on, captionLanguage: 'en' } });
    expect(c.getState().captions.active).toBe('yo');
  });

  it('the toggle turns the chosen default on and off', () => {
    const c = make({ captions: [en, yo], preferences: { captionLanguage: 'yo' } });
    c.toggleCaptions();
    expect(c.getState().captions.active).toBe('yo');
    c.toggleCaptions();
    expect(c.getState().captions.active).toBeNull();
  });
});

describe('a caption language that fails to load', () => {
  it('falls back to English and says so', () => {
    const c = make({ captions: [en, yo], preferences: { ...on, captionLanguage: 'yo' } });
    c.captionFailed('yo');
    expect(c.getState().captions.active).toBe('en');
    expect(c.getState().toast).toMatchObject({
      kind: 'error',
      message: 'That language could not load. Showing English.',
    });
  });

  it('English failing keeps the plain message and does not loop', () => {
    const c = make({ captions: [en, yo], preferences: { ...on, captionLanguage: 'en' } });
    c.captionFailed('en');
    expect(c.getState().toast?.message).toBe('Captions could not load');
  });
});

describe('the t prop', () => {
  it('announcements come from the t function the host gave', () => {
    const t = vi.fn((key: string) => `<${key}>`);
    const c = make({ captions: [en], t: t as never });
    c.selectCaption(null);
    expect(c.getState().announce).toBe('<player.captionsOff>');
  });
});
