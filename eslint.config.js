import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import noHardcodedCopy from './scripts/eslint-rules/no-hardcoded-copy.mjs';

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
      '.e2e-storage/**',
      '.m1-storage/**',
      'next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
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
  {
    // M34-S04 AC2: files already moved to the message catalog may not gain literal user facing text.
    // Add a file here when it is wired. Allowlist exact strings that are not copy (docs/lanes/R1-stories.md).
    files: [
      'apps/web/src/components/ViewerChrome.tsx',
      'apps/web/src/components/Shell.tsx',
      'apps/web/src/components/guest/GuestChrome.tsx',
      'apps/web/src/components/KidsExitDialog.tsx',
      'apps/web/src/components/pwa/OfflineCopy.tsx',
      'apps/web/src/app/(viewer)/title/[slug]/error.tsx',
      'apps/web/src/app/error.tsx',
      'apps/web/src/app/global-error.tsx',
      'apps/web/src/components/CatalogCard.tsx',
      'apps/web/src/components/KidsGate.tsx',
      'apps/web/src/components/SignOutButton.tsx',
      'apps/web/src/components/guest/GuestIntentApplier.tsx',
      'apps/web/src/components/pwa/ConnectionStatus.tsx',
      'apps/web/src/components/pwa/InstallPrompt.tsx',
      'apps/web/src/components/pwa/PwaClient.tsx',
      'apps/web/src/components/pwa/QueueSync.tsx',
      'apps/web/src/features/player/WatchActions.tsx',
      'apps/web/src/features/player/WatchClient.tsx',
      'apps/web/src/components/account/AccountNav.tsx',
      'apps/web/src/components/account/AccountStates.tsx',
      'apps/web/src/components/account/ChangePassword.tsx',
      'apps/web/src/components/account/DataPanel.tsx',
      'apps/web/src/components/account/DeletionNotice.tsx',
      'apps/web/src/components/account/DevicesPanel.tsx',
      'apps/web/src/components/account/EditName.tsx',
      'apps/web/src/components/account/EmailCard.tsx',
      'apps/web/src/components/account/InlineToast.tsx',
      'apps/web/src/components/account/PasswordStrength.tsx',
      'apps/web/src/components/account/PlaybackSettings.tsx',
      'apps/web/src/components/account/SecurityView.tsx',
      'apps/web/src/components/auth/AuthParts.tsx',
      'apps/web/src/components/auth/RecoveryForms.tsx',
      'apps/web/src/components/auth/SignInForm.tsx',
      'apps/web/src/components/auth/SignUpForm.tsx',
      'apps/web/src/components/auth/TurnstileWidget.tsx',
      'apps/web/src/components/auth/VerifyEmailForm.tsx',
      'apps/web/src/components/consent/StorageNotice.tsx',
      'apps/web/src/components/errors/ErrorPage.tsx',
      'apps/web/src/components/profiles/PinDialog.tsx',
      'apps/web/src/components/profiles/ProfileForm.tsx',
      'apps/web/src/components/profiles/ProfilePicker.tsx',
      'apps/web/src/components/site/HelpFaq.tsx',
      'apps/web/src/components/site/LegalToc.tsx',
      'apps/web/src/components/browse/CardGrid.tsx',
      'apps/web/src/components/browse/ListPageView.tsx',
      'apps/web/src/components/browse/SearchBox.tsx',
      'apps/web/src/components/browse/SlowDown.tsx',
      'apps/web/src/components/browse/VoiceSearchButton.tsx',
      'apps/web/src/components/home/LazyHomeRows.tsx',
      'apps/web/src/components/mylist/MyListGrid.tsx',
      'apps/web/src/components/title/EpisodeList.tsx',
      'apps/web/src/components/title/ExpandableText.tsx',
      'apps/web/src/components/title/TitleActions.tsx',
      'apps/web/src/components/account/pages.ts',
      'apps/web/src/components/account/AlwaysAskSetting.tsx',
      'apps/web/src/components/profiles/CachedPicker.tsx',
      'apps/web/src/lib/auth-notices.ts',
      'apps/web/src/server/auth/form-errors.ts',
      'packages/player/src/controller.ts',
      'packages/player/src/ui/Overlays.tsx',
      'packages/player/src/ui/PlayerView.tsx',
      'packages/player/src/ui/SeekBar.tsx',
      'packages/player/src/ui/ShortcutsDialog.tsx',
      'packages/player/src/ui/EndScreen.tsx',
      'packages/player/src/ui/CaptionAppearance.tsx',
      'packages/player/src/ui/Menus.tsx',
      'packages/player/src/ui/SettingsMenu.tsx',
      'packages/player/src/ui/SkipButton.tsx',
      'packages/player/src/ui/StillWatching.tsx',
      'packages/player/src/format.ts',
    ],
    plugins: { ad: { rules: { 'no-hardcoded-copy': noHardcodedCopy } } },
    rules: { 'ad/no-hardcoded-copy': ['error', { allow: ['S', '0 to 9', 'Shift ,', 'Shift .', 'Too short'] }] },
  },
  prettier,
);
