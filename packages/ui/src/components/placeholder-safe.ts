// Plain functions with no client code, so server components can import them (a 'use client' module's
// exports cannot be called from the server).
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
