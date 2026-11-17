import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // *.int.test.ts files skip themselves unless TEST_DATABASE_ADMIN_URL is set.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
