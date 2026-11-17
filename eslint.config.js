import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const forbidApps = (names) => ({
  patterns: names.map((name) => ({
    group: [name, `${name}/*`],
    message: 'Packages never import apps, and apps never import each other.',
  })),
});

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      'packages/db/migrations/**',
      '.claude/**',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Apps log through createLogger from @ad/shared. console is banned so nothing leaks past the redactor.
    files: ['apps/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['packages/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', forbidApps(['@ad/web', '@ad/worker'])],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs['core-web-vitals'].rules,
      // App Router only, there is no pages directory.
      '@next/next/no-html-link-for-pages': 'off',
      'no-restricted-imports': ['error', forbidApps(['@ad/worker'])],
    },
  },
  {
    // Route files call repositories under src/server, they never touch tables directly.
    files: ['apps/web/src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@ad/db', '@ad/db/*'],
              message: 'Call a repository under src/server instead of importing @ad/db in a route.',
            },
            {
              group: ['@ad/worker', '@ad/worker/*'],
              message: 'Packages never import apps, and apps never import each other.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/worker/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', forbidApps(['@ad/web'])],
    },
  },
  prettier,
);
