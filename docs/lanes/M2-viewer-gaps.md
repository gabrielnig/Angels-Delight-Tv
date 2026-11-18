# Lane M2: viewer gaps

Seven slices, one PR each, all merged. Decisions are in `docs/DECISIONS.md`: D-092 (deletion), D-096 (export), D-100 (PIN), D-108 (player preferences), D-109 (site pages), D-119 (avatars), D-123 (cache and ETag), D-124 (slug redirects and undo). Numbers D-109 and D-119 may appear twice in the file because lanes renumbered during rebases; the titles tell them apart.

## What exists

### 1. Account deletion with a 14 day grace period (D-092, migration 0020)
- `deleteAccount` schedules deletion and returns `{ purgeAfter }`. The account status is `pending_deletion`, and `account_deletions.purge_after` holds the end of the grace period (`deletionGraceDays: 14`).
- Signing in during the grace period opens a cancel only session. Every consumer checks `status === 'active'`, so everything else fails closed.
- `getDeletionState`, `cancelDeletion`, `purgeDueDeletions`, `purgeOne` in `@ad/auth` (`packages/auth/src/accounts.ts`). The purge crypto shreds the account keys. It runs in the web process (`runDeletionJobs` in `shred-retry.ts`, started from `instrumentation.ts`).
- Mailer template `deletion_scheduled` (`sendDeletionScheduled`).
- Route `/account/deletion` with `DeletionNotice` and `DeletionNoticeScreen`; `cancelDeletionAction`. Signed in pending accounts are redirected there by `lib/session.ts`.

### 2. Data export as a background job (D-096, migration 0021)
- `data_exports` holds state only, never the file. `ExportJobs` (`apps/web/src/server/data/export-jobs.ts`): `request`, `state`, `hasActive`, `runPending`. The job runs in the web process, is kicked by the request and retried every 2 minutes.
- One export per 24 hours, password required. The email carries a signed link (`signExportToken(accountId, expiresAt?)`), valid 24 hours. The download route rebuilds the file behind the token and sends a signed out visitor to sign in first.
- Mailer templates `export_ready` and `export_failed`. `DataPanel` shows the S30 states.

### 3. PIN entry (D-100)
- `selectProfile(ctx, actor, profileId, { pin?, password?, kidsLocked? })` checks the PIN or the account password. Rate limits use the `profile_pin` and `kids_exit` buckets, 5 attempts per 15 minutes.
- UI: `PinDialog` (uses `OtpInput`, length 4), `PickerScreen`, PIN set and remove in `ProfileForm` (needs the password). `selectProfileAction(profileId, proof)` and `checkKidsPasswordAction` in `app/actions.ts`.

### 4. Server side player preferences (D-108)
- Speed, captions, caption language, data saver and autoplay are stored per profile (`profiles.playback_prefs` and the dedicated columns). Volume and mute stay in the browser.
- `features/player/preferences.ts`: `loadPreferences`, `savePreferences` (volume and mute only), `readLegacyPreferences`, `clearLegacyPreferences`, `serverChanges`. `savePlayerPrefsAction` and `migrateDevicePrefsAction` save and migrate once per profile (`deviceMigrated`), then the old browser copy is cleared. `WatchClient` waits for `prefsReady`.

### 5. Legal and site pages from the editor (D-109, migration 0026)
- Terms, privacy, about and help render from `settings` rows `pages.<slug>`. The migration seeds clearly marked placeholder text (`PAGE_PLACEHOLDERS`, `isPlaceholderBody` in `@ad/theme`). Real mode never serves fixture text for these pages. `RealSite(settings, now?)`; defaults in `lib/site/defaults.ts`.

### 6. Mockup parity (D-119)
- Closes `docs/DESIGN-REVIEW.md` findings 1, 2, 4, 5, 6, 7, 8.
- Account overview built from cards with an active nav state (`AccountNav`, `AccountOverview`).
- Title page: two columns from 960px with a breadcrumb.
- Auth card surface with border and shadow on every auth page, including sign in.
- Twelve original inline SVG avatars (`AVATAR_ART`, `AVATAR_ART_IDS` in `@ad/ui`), an avatar picker in `ProfileForm`, `Profile.avatarId`, `ProfileInput.avatarId`.
- `--motion-spin` and `--motion-shimmer` tokens, used by `components.css` and `admin.css`.
- Continue card reads the title first, then the length, the percent watched and the time left.
- Admin links (`.adm-list__title`, `.adm-vtitle`, `.adm-crumbs a`) are 44px.

### 7. Catalog extras (D-123, D-124, migration 0029)
- Slug redirects: `changeSlug`, `slugProblem`, `RESERVED_SLUGS` (`@ad/catalog` admin). `VideoEdit.slug` and `SeriesEdit.slug` keep the old address in `slug_redirects`. The editor has an Address field. Viewer pages answer an old address with a permanent redirect.
- Artwork record editing (M36): `updateArtworkRecord(ctx, actor, assetId, { alt?, placeholderColor? })` in `@ad/catalog` admin. Alt up to 200 characters, colour as six digit hex, picture must be ready, audited as `asset.update`.
- Catalog cache and ETag (M04-S05): `CatalogCache`, `catalogCache`, `invalidateCatalogCache` in `@ad/catalog`; `ViewerContext.catalogCache`; `etagJson` in `apps/web/src/server/viewer/http.ts`.
- Open Graph and public preview: `CatalogRepository.publicPreview(slug, kind)` returns a video, a series or a redirect. `previewMetadata` and `largestImage` in `apps/web/src/lib/seo.ts`. `PublicSeries` for signed out visitors. `metadataBase` comes from `APP_ORIGIN` when set.
- "Add your first video" on an empty Home for staff: `HomeEmpty canUpload`, `ViewerSession.canUpload`. This is what the lane C note called the kids admin link.
- Cards carry `categorySlug`, `categoryName` and `publishedAt` (first visible category by position).
- Continue Watching undo in the database: `removeProgress` stores the position, `restoreProgress` puts it back (5 minutes, once, never over newer progress). Table `watch_progress_removals` with owner RLS.

## Exported APIs

| Package | Added |
|---|---|
| `@ad/auth` | `getDeletionState`, `cancelDeletion`, `purgeDueDeletions`, `purgeOne`; `signIn` can return `status: 'pending_deletion'` |
| `@ad/viewer` | `selectProfile` options `{ pin, password, kidsLocked }`; `removeProgress` with `requestedId`; `restoreProgress`; `PROGRESS_UNDO_WINDOW_MS`; `ViewerContext.catalogCache` |
| `@ad/catalog` | `CatalogCache`, `catalogCache`, `invalidateCatalogCache`; admin `changeSlug`, `slugProblem`, `RESERVED_SLUGS`, `updateArtworkRecord`; `AdminVideo.slug`; `TitleCard.categorySlug`, `categoryName`, `publishedAt` |
| `@ad/ui` | `AVATAR_ART`, `AVATAR_ART_IDS`, `Avatar avatarId`, `ProfileTile avatarId`, `EmptyState children` |
| `@ad/mailer` | `deletion_scheduled`, `export_ready`, `export_failed` |
| `@ad/theme` | `PAGE_PLACEHOLDERS`, `isPlaceholderBody` |

## Routes

| Route | Notes |
|---|---|
| `/account/deletion` | Cancel only screen for a pending deletion |
| `/account`, `/account/security`, `/account/data`, `/settings/playback` | Account pages with the active nav |
| `/title/[slug]`, `/series/[slug]` | Signed out visitors get a public preview and full Open Graph. Old addresses redirect permanently |
| `GET /api/home`, `/api/browse`, `/api/browse/categories`, `/api/titles/[id]` | Send `ETag`, `Cache-Control: private, no-cache`, answer 304 on `If-None-Match` |
| Export download route | Signed token, 24 hours |

## Scoped test commands
Integration tests need `TEST_DATABASE_ADMIN_URL` (see `docs/DEV-SETUP.md` section 5) set in the same command. Never run the full suite.

```
pnpm vitest run packages/auth/src/accounts.int.test.ts
pnpm vitest run apps/web/src/server/data/export-jobs.int.test.ts
pnpm vitest run apps/web/src/components/profiles
pnpm vitest run apps/web/src/features/player/preferences.test.ts
pnpm vitest run packages/theme/src/page-seed.int.test.ts apps/web/src/server/data/real-site.test.ts
pnpm vitest run packages/ui/src/components/Cards.test.tsx packages/ui/src/components/AvatarArt.test.tsx packages/ui/src/motion-tokens.test.ts
pnpm vitest run apps/web/src/components/account apps/web/src/components/title apps/web/src/app/auth-card-css.test.ts apps/web/src/components/admin/admin-css.test.ts
pnpm vitest run packages/catalog/src/cache.test.ts packages/catalog/src/audit.test.ts packages/catalog/src/admin/slugs.test.ts
TEST_DATABASE_ADMIN_URL=... pnpm vitest run packages/catalog/src/admin/slugs.int.test.ts packages/catalog/src/admin/artwork-record.int.test.ts packages/catalog/src/titles.int.test.ts
TEST_DATABASE_ADMIN_URL=... pnpm vitest run packages/viewer/src/catalog-cache.int.test.ts packages/viewer/src/progress-undo.int.test.ts
TEST_DATABASE_ADMIN_URL=... pnpm vitest run apps/web/src/server/viewer/http.test.ts apps/web/src/server/viewer/api.int.test.ts apps/web/src/server/data/real-catalog.int.test.ts apps/web/src/server/data/real-library.int.test.ts
```

Browser checks for touched pages: start `ADMIN_DATA=fixture VIEWER_FIXTURES=on AUTH_FIXTURES=on pnpm --filter @ad/web exec next dev -p 3500`, then `E2E_CHROMIUM_PATH=/opt/google/chrome/chrome E2E_BASE_URL=http://localhost:3500 pnpm --filter @ad/web exec playwright test e2e/a11y.e2e.ts -g "<route>"`. The older flags `ADMIN_FIXTURES` and `ADMIN_DATA` differ: use `ADMIN_DATA=fixture`.

## Gaps
- The a11y e2e has no real data state for `/account/deletion`; it only covers fixture mode.
- Pending deletion accounts do not show in the admin users list.
- The old device scoped 5 minute PIN lock became a server limit of 5 attempts per 15 minutes.
- `useDataSaver` still reads the local browser signal as well as the profile setting. Volume and mute stay local.
- The S29 playback settings page has no caption language control.
- The account overview has no profiles card yet, and the top nav shows the letter avatar, not the illustrated one.
- Sign in and sign up have the card surface but not the states strip from the mockups.
- The catalog cache is per process. A second web instance can be up to 60 seconds behind an edit. Caption approval does not pass through the audit wrapper, so the captions badge can lag by 60 seconds.
- Series cards show `seasonCount: 1` because the card query does not count seasons. The series preview shows the episode count only.
- Slug rules: the database allows 120 characters, the story says 80. Numeric suffixes (`-2`) are not added automatically, a clash is refused with a message.
- Artwork record editing is a service only. The poster picker still edits alt text through `setAdminPoster`.
- Fixtures serve only with the dev flags. Production never serves them.
- The first title of a series or video with no visible category gets an empty category line.
