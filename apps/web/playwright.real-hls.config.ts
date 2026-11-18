import { defineConfig } from '@playwright/test';

/**
 * The real stack HLS journey (apps/web/e2e/hls-real.stack.ts). No Next server and no database: the spec starts
 * its own playback stack. Needs ffmpeg and a browser with H.264, so run it with Chrome:
 *   E2E_CHROMIUM_PATH=/opt/google/chrome/chrome pnpm exec playwright test --config apps/web/playwright.real-hls.config.ts
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '*.stack.ts',
  workers: 1,
  timeout: 120_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    viewport: { width: 1000, height: 700 },
    launchOptions: {
      ...(process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {}),
      args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    },
  },
});
