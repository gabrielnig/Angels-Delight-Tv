'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

const REDUCE = '(prefers-reduced-motion: reduce)';
/** The most the clock waits for a slide image before it starts anyway. */
export const HERO_IMAGE_WAIT_MS = 1500;

function subscribeReduced(onChange: () => void) {
  const query = window.matchMedia?.(REDUCE);
  query?.addEventListener?.('change', onChange);
  return () => query?.removeEventListener?.('change', onChange);
}

/** Reduced motion, read live so changing the device setting while the page is open takes effect (M41-S02 AC4). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia?.(REDUCE).matches ?? false,
    () => false,
  );
}

function useTabHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const read = () => setHidden(document.visibilityState === 'hidden');
    read();
    document.addEventListener('visibilitychange', read);
    return () => document.removeEventListener('visibilitychange', read);
  }, []);
  return hidden;
}

/**
 * The hero clock (M41-S02). One timeout per slide that keeps the time already spent while it is held, restarts on
 * any manual change, starts once the slide image has loaded (or after 1.5 seconds), and stops on the first slide
 * after `maxLoops` rounds (0 never stops). Reduced motion, hover, focus, a hidden tab and the viewer's Pause all hold it.
 */
export function useHeroTimer({
  count,
  intervalMs,
  slideMs,
  maxLoops,
  slideHasImage,
}: {
  count: number;
  /** The dwell time. Leave undefined for no rotation (Data saver, owner switch off). */
  intervalMs?: number;
  /** How long slide `index` stays when that differs from `intervalMs`, for example while it waits for its clip. */
  slideMs?: (index: number) => number | undefined;
  maxLoops: number;
  /** True when the current slide waits for an image before the clock starts. */
  slideHasImage: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [armedKey, setArmedKey] = useState('');
  const reduced = useReducedMotion();
  const hidden = useTabHidden();

  const current = Math.min(index, Math.max(0, count - 1));
  const key = `${current}:${epoch}`;
  const armed = !slideHasImage || armedKey === key;
  const rotationAllowed = Boolean(intervalMs) && count > 1 && !reduced;
  const canRun = rotationAllowed && !stopped;
  const hold = hovered || focused;
  const running = canRun && !paused && !hold && !hidden && armed;

  const slideLength = (slideMs?.(current) ?? intervalMs) || 0;
  const remaining = useRef(slideLength);
  const startedAt = useRef(0);
  const autoSteps = useRef(0);

  // A new slide or a manual change gives the slide its whole time again.
  useEffect(() => {
    remaining.current = slideLength;
  }, [key, slideLength]);

  // Do not wait for a slow image for more than 1.5 seconds.
  useEffect(() => {
    if (!slideHasImage) return;
    const timer = setTimeout(() => setArmedKey(key), HERO_IMAGE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [key, slideHasImage]);

  const advance = useCallback(() => {
    autoSteps.current += 1;
    if (maxLoops > 0 && autoSteps.current >= count * maxLoops) {
      setIndex(0);
      setStopped(true);
      return;
    }
    setIndex((value) => (value + 1) % count);
  }, [count, maxLoops]);

  useEffect(() => {
    if (!running) return;
    startedAt.current = Date.now();
    const timer = setTimeout(advance, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [running, key, slideLength, advance]);

  // The end of a slide's clip moves the carousel on, but only while it is really running (not paused or held).
  const runningRef = useRef(false);
  runningRef.current = running;
  const advanceNow = useCallback(() => {
    if (runningRef.current) advance();
  }, [advance]);

  const go = useCallback((target: number) => {
    setIndex(target);
    setEpoch((value) => value + 1);
  }, []);
  const step = useCallback(
    (delta: number) => go((current + delta + count) % count),
    [count, current, go],
  );

  return {
    index: current,
    key,
    go,
    step,
    paused,
    togglePause: () => setPaused((value) => !value),
    setHovered,
    setFocused,
    reduced,
    running,
    slideLength,
    advanceNow,
    showPause: rotationAllowed && !stopped,
    showFill: rotationAllowed && !stopped,
    live: running ? ('off' as const) : ('polite' as const),
    imageReady: () => setArmedKey(key),
  };
}
