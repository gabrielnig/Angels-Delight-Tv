/**
 * AirPlay helpers (L4-10, R16). Safari only: the picker and its events are webkit prefixed. The button that uses
 * them stays hidden until the device spike passes (docs/spikes/airplay.md), so nothing here runs by default.
 */

interface AirplayVideo {
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
}

type VideoLike = (EventTarget & AirplayVideo) | HTMLVideoElement | null | undefined;

const as = (video: VideoLike) => video as (EventTarget & AirplayVideo) | null | undefined;

export function airplaySupported(video: VideoLike): boolean {
  return typeof as(video)?.webkitShowPlaybackTargetPicker === 'function';
}

/** Calls back with true while Safari sees a device to send to. Returns the function that stops listening. */
export function watchAirplayAvailability(
  video: VideoLike,
  onChange: (available: boolean) => void,
): () => void {
  const el = as(video);
  if (!el || !airplaySupported(el)) return () => undefined;
  const handler = (e: Event) => {
    onChange((e as Event & { availability?: string }).availability === 'available');
  };
  el.addEventListener('webkitplaybacktargetavailabilitychanged', handler);
  return () => el.removeEventListener('webkitplaybacktargetavailabilitychanged', handler);
}

/** Opens Safari's device list. Returns false when the browser has no picker. */
export function showAirplayPicker(video: VideoLike): boolean {
  const el = as(video);
  if (!el || !airplaySupported(el)) return false;
  el.webkitShowPlaybackTargetPicker?.call(el);
  return true;
}

export function wirelessActive(video: VideoLike): boolean {
  return as(video)?.webkitCurrentPlaybackTargetIsWireless === true;
}

/** Calls back whenever playback moves to or from a wireless device. */
export function watchWireless(video: VideoLike, onChange: (wireless: boolean) => void): () => void {
  const el = as(video);
  if (!el) return () => undefined;
  const handler = () => onChange(wirelessActive(el));
  el.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', handler);
  return () => el.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', handler);
}
