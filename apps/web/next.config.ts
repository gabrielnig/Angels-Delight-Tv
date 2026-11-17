import { resolve } from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // Workspace packages ship TypeScript source, so Next compiles them.
  transpilePackages: [
    '@ad/auth',
    '@ad/mailer',
    '@ad/security',
    '@ad/shared',
    '@ad/config',
    '@ad/ui',
    '@ad/db',
    '@ad/storage',
    '@ad/theme',
  ],
  serverExternalPackages: ['pg', '@node-rs/argon2', 'nodemailer', 'qrcode'],
  // Lets the standalone build trace files from the monorepo root.
  outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
};

export default config;
