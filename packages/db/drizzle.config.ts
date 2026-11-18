import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './src/schema/activity.ts',
    './src/schema/auth.ts',
    './src/schema/captions.ts',
    './src/schema/content.ts',
    './src/schema/enums.ts',
    './src/schema/identity.ts',
    './src/schema/notices.ts',
    './src/schema/outbox.ts',
    './src/schema/exports.ts',
    './src/schema/pipeline.ts',
    './src/schema/platform.ts',
    './src/schema/viewer.ts',
  ],
  out: './migrations/main',
});
