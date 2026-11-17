import { defineConfig } from 'vitest/config';

// This app is Python. Its tests run with `pnpm --filter @ad/whisper test:py`, so Vitest has nothing to collect here.
export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    passWithNoTests: true,
  },
});
