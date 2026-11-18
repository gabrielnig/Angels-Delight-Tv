'use client';

import { useCallback, useState, type SyntheticEvent } from 'react';

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const BLUR = /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/;

/** Only a plain hex colour is drawn. Anything else is dropped so stored data can never reach the style attribute. */
export function safePlaceholderColor(value: string | null | undefined): string | undefined {
  return value && HEX.test(value) ? value : undefined;
}

/** Only a webp data url of base64 characters is drawn, so it is safe inside a css url(). */
export function safePlaceholderBlur(value: string | null | undefined): string | undefined {
  return value && value.length <= 2048 && BLUR.test(value) ? value : undefined;
}

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
