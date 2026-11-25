import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['*.test.ts', 'kb-recorder/*.test.ts'],
  },
});
