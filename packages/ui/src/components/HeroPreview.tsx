import { useEffect, useRef, useState } from 'react';

import { HERO_PREVIEW_DELAY_MS } from './hero-timing';

export { HERO_PREVIEW_DELAY_MS };
const STALL_MS = 2000;

/**
 * A muted, decorative clip over the active hero slide. It exists in the page only while `active` is true, so nothing
 * is fetched for other slides. Any failure removes it and the still image stays (M41-S11).
 */
export function HeroPreview({
  src,
  active,
  paused,
  delayMs = HERO_PREVIEW_DELAY_MS,
  onPlayingChange,
  onEnded,
  onFail,
  sound = false,
  onSoundBlocked,
}: {
  src: string;
  active: boolean;
  paused: boolean;
  delayMs?: number;
  /** The clip started or stopped showing. */
  onPlayingChange?: (playing: boolean) => void;
  /** The clip reached its end. */
  onEnded?: () => void;
  /** The clip errored or stalled for 2 seconds and was removed, so the still stays. */
  onFail?: () => void;
  /** The viewer turned sound on. The clip is muted otherwise, and always starts muted on a new visit. */
  sound?: boolean;
  /** The browser refused to play with sound. The clip carries on muted and the carousel shows Unmute again. */
  onSoundBlocked?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const stall = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fail = () => {
    setFailed(true);
    onFail?.();
  };

  useEffect(() => {
    setLoaded(false);
    setPlaying(false);
    if (!active || failed) return;
    const timer = setTimeout(() => setLoaded(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, failed, src, delayMs]);

  useEffect(() => () => clearTimeout(stall.current), []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !loaded) return;
    if (paused) {
      el.pause();
      return;
    }
    void el.play()?.catch(() => {
      if (!el.muted) {
        // A browser can refuse sound for a clip nobody tapped. Keep the picture, drop the sound.
        el.muted = true;
        onSoundBlocked?.();
        void el.play()?.catch(fail);
      } else fail();
    });
  }, [paused, loaded]);

  // A tap on Unmute or Mute reaches the element at once, without remounting the clip.
  useEffect(() => {
    if (ref.current) ref.current.muted = !sound;
  }, [sound, loaded]);

  if (!active || failed) return null;
  const clearStall = () => clearTimeout(stall.current);
  return (
    <video
      ref={ref}
      className="ad-hero__clip"
      src={loaded ? src : undefined}
      preload="none"
      muted={!sound}
      playsInline
      aria-hidden="true"
      tabIndex={-1}
      data-playing={playing ? 'true' : 'false'}
      onPlaying={() => {
        clearStall();
        setPlaying(true);
        onPlayingChange?.(true);
      }}
      onEnded={() => {
        setPlaying(false);
        onPlayingChange?.(false);
        onEnded?.();
      }}
      onError={fail}
      onAbort={fail}
      onStalled={() => {
        clearStall();
        stall.current = setTimeout(fail, STALL_MS);
      }}
    />
  );
}
