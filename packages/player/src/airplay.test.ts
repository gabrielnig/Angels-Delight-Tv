import { describe, expect, it, vi } from 'vitest';
import {
  airplaySupported,
  showAirplayPicker,
  watchAirplayAvailability,
  watchWireless,
  wirelessActive,
} from './airplay';

function fakeVideo(extra: Record<string, unknown> = {}) {
  const target = new EventTarget();
  return Object.assign(target, extra) as unknown as HTMLVideoElement & {
    dispatchEvent(e: Event): boolean;
  };
}

function availability(video: EventTarget, value: 'available' | 'not-available') {
  const e = new Event('webkitplaybacktargetavailabilitychanged');
  Object.assign(e, { availability: value });
  video.dispatchEvent(e);
}

describe('airplay helpers (L4-10, R16)', () => {
  it('is unsupported without the webkit picker method', () => {
    expect(airplaySupported(fakeVideo())).toBe(false);
    expect(airplaySupported(fakeVideo({ webkitShowPlaybackTargetPicker: () => undefined }))).toBe(
      true,
    );
    expect(airplaySupported(null)).toBe(false);
  });

  it('reports availability from the webkit event', () => {
    const video = fakeVideo({ webkitShowPlaybackTargetPicker: () => undefined });
    const seen: boolean[] = [];
    const stop = watchAirplayAvailability(video, (a) => seen.push(a));
    availability(video, 'available');
    availability(video, 'not-available');
    expect(seen).toEqual([true, false]);
    stop();
    availability(video, 'available');
    expect(seen).toEqual([true, false]);
  });

  it('never reports a target on a browser without the picker', () => {
    const video = fakeVideo();
    const cb = vi.fn();
    const stop = watchAirplayAvailability(video, cb);
    availability(video, 'available');
    expect(cb).not.toHaveBeenCalled();
    stop();
  });

  it('calls the picker with the video element as this', () => {
    const picker = vi.fn(function (this: unknown) {
      return this;
    });
    const video = fakeVideo({ webkitShowPlaybackTargetPicker: picker });
    expect(showAirplayPicker(video)).toBe(true);
    expect(picker).toHaveBeenCalledTimes(1);
    expect(picker.mock.results[0]?.value).toBe(video);
    expect(showAirplayPicker(fakeVideo())).toBe(false);
  });

  it('tracks wireless playback state', () => {
    const video = fakeVideo({
      webkitShowPlaybackTargetPicker: () => undefined,
      webkitCurrentPlaybackTargetIsWireless: false,
    });
    expect(wirelessActive(video)).toBe(false);
    const seen: boolean[] = [];
    watchWireless(video, (w) => seen.push(w));
    Object.assign(video, { webkitCurrentPlaybackTargetIsWireless: true });
    video.dispatchEvent(new Event('webkitcurrentplaybacktargetiswirelesschanged'));
    Object.assign(video, { webkitCurrentPlaybackTargetIsWireless: false });
    video.dispatchEvent(new Event('webkitcurrentplaybacktargetiswirelesschanged'));
    expect(seen).toEqual([true, false]);
    expect(wirelessActive(video)).toBe(false);
  });
});
