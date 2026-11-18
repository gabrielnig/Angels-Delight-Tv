import localFont from 'next/font/local';

/**
 * Space Grotesk, the display face of the sign in and sign up mockups (S01, S02). Self hosted, variable weight,
 * applied only to the auth screens through the two custom properties below (decision D-AUTH-FONT in docs/DECISIONS.md).
 * The variable classes define properties only, so body text keeps the theme font.
 */
const grotesk = localFont({
  src: [{ path: '../fonts/space-grotesk-latin-wght-normal.woff2', weight: '300 700', style: 'normal' }],
  display: 'swap',
  variable: '--font-auth-display',
});
const groteskExt = localFont({
  src: [{ path: '../fonts/space-grotesk-latin-ext-wght-normal.woff2', weight: '300 700', style: 'normal' }],
  display: 'swap',
  preload: false,
  variable: '--font-auth-display-ext',
});

export const authDisplayClasses = `${grotesk.variable} ${groteskExt.variable}`;
