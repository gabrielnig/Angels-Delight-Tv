import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayerController } from '../controller';
import { FakeEngine, FakeMedia, FakeNetwork } from '../testing/fakes';
import { PlayerView, type PlayerViewProps } from './PlayerView';

const proto = HTMLVideoElement.prototype as unknown as Record<string, unknown>;

function setup(view: Partial<PlayerViewProps> = {}) {
  const media = new FakeMedia();
  const picker = vi.fn(() => true);
  const controller = new PlayerController({
    media,
    engine: new FakeEngine(),
    tokens: { token: 't', masterUrl: 'https://app.test/m.m3u8', refresh: vi.fn() },
    videoId: 'v1',
    profileId: 'p1',
    sink: { save: vi.fn().mockResolvedValue(undefined) },
    network: new FakeNetwork(),
    showAirplayPicker: picker,
  });
  controller.start();
  act(() => media.setDuration(300));
  render(<PlayerView controller={controller} title="Rain" {...view} />);
  const video = document.querySelector('video')!;
  return { controller, picker, video };
}

function target(video: HTMLVideoElement, availability: 'available' | 'not-available') {
  const e = new Event('webkitplaybacktargetavailabilitychanged');
  Object.assign(e, { availability });
  act(() => void video.dispatchEvent(e));
}

afterEach(() => {
  cleanup();
  delete proto.webkitShowPlaybackTargetPicker;
});

describe('PlayerView AirPlay (L4-10, R16)', () => {
  it('is hidden by default, even in Safari with a device nearby', () => {
    proto.webkitShowPlaybackTargetPicker = () => undefined;
    const { video } = setup();
    target(video, 'available');
    expect(screen.queryByRole('button', { name: 'AirPlay' })).toBeNull();
  });

  it('shows the button only when the flag is on and a device is available', () => {
    proto.webkitShowPlaybackTargetPicker = () => undefined;
    const { video } = setup({ airplay: true });
    expect(screen.queryByRole('button', { name: 'AirPlay' })).toBeNull();
    target(video, 'available');
    expect(screen.getByRole('button', { name: 'AirPlay' })).toBeTruthy();
    target(video, 'not-available');
    expect(screen.queryByRole('button', { name: 'AirPlay' })).toBeNull();
  });

  it('never shows the button in a browser without the picker', () => {
    const { video } = setup({ airplay: true });
    target(video, 'available');
    expect(screen.queryByRole('button', { name: 'AirPlay' })).toBeNull();
  });

  it('opens the device list through the controller', () => {
    proto.webkitShowPlaybackTargetPicker = () => undefined;
    const { video, picker } = setup({ airplay: true });
    target(video, 'available');
    fireEvent.click(screen.getByRole('button', { name: 'AirPlay' }));
    expect(picker).toHaveBeenCalledTimes(1);
  });

  it('says Playing on AirPlay while wireless, and goes back when it stops', () => {
    proto.webkitShowPlaybackTargetPicker = () => undefined;
    const { video } = setup({ airplay: true });
    Object.assign(video, { webkitCurrentPlaybackTargetIsWireless: true });
    act(() => void video.dispatchEvent(new Event('webkitcurrentplaybacktargetiswirelesschanged')));
    expect(screen.getByText('Playing on AirPlay')).toBeTruthy();
    Object.assign(video, { webkitCurrentPlaybackTargetIsWireless: false });
    act(() => void video.dispatchEvent(new Event('webkitcurrentplaybacktargetiswirelesschanged')));
    expect(screen.queryByText('Playing on AirPlay')).toBeNull();
  });
});
