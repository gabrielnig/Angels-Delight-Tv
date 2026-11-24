import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CAPTION_STYLE } from '../captionStyle';
import { PlayerController } from '../controller';
import { FakeEngine, FakeMedia, FakeNetwork } from '../testing/fakes';
import { PlayerView, type PlayerViewProps } from './PlayerView';

function setup(view: Partial<PlayerViewProps> = {}) {
  const media = new FakeMedia();
  const controller = new PlayerController({
    media,
    engine: new FakeEngine(),
    tokens: { token: 't', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
    network: new FakeNetwork(),
    captions: [
      { id: 'en', label: 'English', language: 'en', src: '/en.vtt', status: 'approved' },
      { id: 'yo', label: 'Yoruba', language: 'yo', src: '/yo.vtt', status: 'approved' },
    ],
  } as never);
  controller.start();
  act(() => media.setDuration(300));
  const onChange = vi.fn();
  render(
    <PlayerView
      controller={controller}
      title="Rain"
      captionStyle={DEFAULT_CAPTION_STYLE}
      onCaptionStyleChange={onChange}
      {...view}
    />,
  );
  return { onChange, controller };
}

afterEach(cleanup);

describe('PlayerView caption appearance (L4-07)', () => {
  it('opens Caption appearance from the Captions menu and applies a change to the video at once', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Captions, off' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Caption appearance' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Edge, Outline' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ edge: 'outline' }));
    const region = document.querySelector('.adp') as HTMLElement;
    expect(region.style.getPropertyValue('--adp-cue-edge')).toContain('-1px');
  });

  it('shows no Caption appearance link when the host cannot save the choice', () => {
    setup({ onCaptionStyleChange: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'Captions, off' }));
    expect(screen.queryByRole('menuitem', { name: 'Caption appearance' })).toBeNull();
  });
});
