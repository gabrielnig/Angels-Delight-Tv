'use client';

import { useCallback, useState, type SyntheticEvent } from 'react';

/**
 * Tracks whether an image has finished loading, so it can fade in over its placeholder (M08-S27).
 * The ref callback catches images that finished before React attached, such as cached ones.
 */
export function useImageLoaded() {
  const [loaded, setLoaded] = useState(false);
  const ref = useCallback((node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);
  const onLoad = useCallback((_event?: SyntheticEvent<HTMLImageElement>) => setLoaded(true), []);
  return { loaded, ref, onLoad };
}
