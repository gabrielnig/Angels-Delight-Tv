import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { msg, type Translate } from '@ad/shared/messages';
import { Player } from './Player';
import type { PlayerController } from './controller';
import type { CaptionTrack } from './types';
import { FakeEngine, FakeNetwork, FakePage } from './testing/fakes';

const track = (language: string, label: string): CaptionTrack => ({
  id: language,
  language,
  label,
  src: `/c/${language}.vtt`,
  status: 'approved',
});
const t: Translate = (key, params) => `[${msg(key, params)}]`;

async function mount(extra: Partial<React.ComponentProps<typeof Player>>) {
  let controller: PlayerController | null = null;
  render(
    <Player
      videoId="v1"
      profileId="p1"
      title="How Rain Is Made"
      appOrigin="https://app.test"
      sessionProvider={{ createSession: vi.fn() }}
      initialSession={{ token: 'x', expiresAt: Date.now() + 1e6, masterUrl: 'https://app.test/m.m3u8' }}
      progressSink={{ save: vi.fn().mockResolvedValue(undefined) }}
      createEngine={async () => new FakeEngine()}
      network={new FakeNetwork()}
      page={new FakePage()}
      onController={(c) => {
        controller = c ?? controller;
      }}
      {...extra}
    />,
  );
  await waitFor(() => expect(controller).not.toBeNull());
  return controller as unknown as PlayerController;
}

describe('Player t and uiLanguage props (M46-S14)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  });
  afterEach(() => vi.restoreAllMocks());

  it('passes t to the view and the controller', async () => {
    const c = await mount({ t, captions: [track('en', 'English')] });
    await screen.findByRole('button', { name: '[Captions]' });
    act(() => c.selectCaption(null));
    expect(c.getState().announce).toBe('[Captions off]');
  });

  it('passes uiLanguage so it picks the default track after the profile language', async () => {
    const c = await mount({
      captions: [track('en', 'English'), track('yo', 'Yorùbá')],
      preferences: { captionsOn: true, captionLanguage: 'ig' },
      uiLanguage: 'yo',
    });
    expect(c.getState().captions.active).toBe('yo');
  });
});
