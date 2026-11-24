import { useEffect, useRef, useState } from 'react';

/** The still shows first, the clip waits this long before it loads. */
export const HERO_PREVIEW_DELAY_MS = 1200;
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
}: {
  src: string;
  active: boolean;
  paused: boolean;
  delayMs?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const stall = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
    if (paused) el.pause();
    else void el.play()?.catch(() => setFailed(true));
  }, [paused, loaded]);

  if (!active || failed) return null;
  const clearStall = () => clearTimeout(stall.current);
  return (
    <video
      ref={ref}
      className="ad-hero__clip"
      src={loaded ? src : undefined}
      preload="none"
      muted
      playsInline
      aria-hidden="true"
      tabIndex={-1}
      data-playing={playing ? 'true' : 'false'}
      onPlaying={() => {
        clearStall();
        setPlaying(true);
      }}
      onEnded={() => setPlaying(false)}
      onError={() => setFailed(true)}
      onAbort={() => setFailed(true)}
      onStalled={() => {
        clearStall();
        stall.current = setTimeout(() => setFailed(true), STALL_MS);
      }}
    />
  );
}
