# Lane L7 build notes (module M46, languages)

Plan: `docs/plan/v2/L7-languages.md`. Rulings: `docs/plan/v2/RULINGS.md` (R23: engine off by default, NLLB is non commercial). Worktree `/home/claude/wt2/L7-build`, branch per slice `l7/sNN-...`.
Scoped tests only: `pnpm vitest run <file>`.

## Slices
| Slice | What | PR |
|---|---|---|
| 1 | Locale registry, plurals, numbers, dates, durations | 280 |
| 2 | Catalog loader, merge, validation, pseudo locale, namespaces | 284 |
| 3 | Migration 0040 and schema (ui tables, caption published, translation source) | see PR list |
| 12 | Translation adapter | 323 |
| 12b | Usage cap | 325 |
| 13 | caption.translate queue and job | 337 |
| 14 | Publish switch, viewer track lists, player t prop | 346 |
| 15 | Admin caption screens by language | 356 |
| 16 | Spoken language, multilingual Whisper, detection | 363 |
| 17 | Mail templates by locale, offline page language, accounts.locale | L7c, see below |
| 18, waves D onward, draft catalogs, docs | not built | none |

## Slice 1
- `packages/shared/src/messages/locales.ts`: `LOCALES`, `LOCALE_CODES`, `normalizeLocale`, `parseAcceptLanguage`, `pickLocale`, `localeInfo`.
- `intl.ts` (`pluralCategory`, `formatNumber`, `formatDate`) and `format.ts` (`formatDuration(minutes, t)` reads `format.duration.*` from the catalog). `formatDuration` moved out of `messages.ts`; the barrel still exports it.
- `MessageText` plural objects are now keyed by CLDR category with `other` required. `createMessages('en', ...)` reads the `en-NG` catalog.
- Decision: see `docs/DECISIONS.md` ($D).

## Slice 2
- `packages/shared/src/messages`: `validate.ts` (`validateTranslation`, `pluralCategoriesFor`), `merge.ts` (`resolveText`, `effectiveCatalog`), `pseudo.ts`, `catalogs.ts` (`BASELINES`), `locales/{yo,ig,ha,pcm}.json` (empty).
- `apps/web/src/lib/i18n`: `server.ts` (`getTranslator(locale)`, `loadCatalog`, `registerCatalogOverlay`, `registerMissingSink`), `provider.tsx` (`I18nProvider`, `useT`, `useLocale`), `namespaces.ts` (`pickNamespaces`).
- Env `DEV_PSEUDO_LOCALE` (web, rejected in production). The pseudo locale code is `xx`.
- Decision D-270.

## Slice 3
- Migration \`0040_i18n_and_caption_languages.sql\` (taken after other lanes used 0038 and 0039). Tables \`ui_translations\`, \`ui_missing_keys\`, \`translation_usage\`, enum \`ui_translation_status\`, columns \`caption_tracks.published\`, \`captions.source_caption_id\`, \`captions.source_sha256\`.
- Schema: \`packages/db/src/schema/i18n.ts\` (also added to \`drizzle.config.ts\`, which lists schema files explicitly). Function \`record_missing_key(locale, key, hits)\`.
- RLS: viewers read approved \`ui_translations\` only, staff (editor, admin, super_admin) read and write all. \`ui_missing_keys\` has no insert path except the function.
- Test: \`TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm vitest run packages/db/src/i18n.int.test.ts packages/db/src/schema.int.test.ts\`
- Decision: see the "Caption track publish flag and missing key function" entry in docs/DECISIONS.md.
- Snapshot note: migration 0039 (sponsors, another lane) shipped without a drizzle snapshot, so `meta/0040_snapshot.json` also contains the sponsor tables. The 0040 SQL file holds only the i18n statements. Its journal `when` is set above 0039 so databases already at 0039 still apply it.

## Slice 4
- `apps/web/src/lib/i18n/resolve.ts` (`resolveLocale`), `cookie.ts` (`LOCALE_COOKIE`, `localeCookieOptions`, `readLocaleCookie`), `server.ts` `getLocale()`. `proxy.ts` sets the cookie for `?lang=` and forwards `x-ad-locale-hint` and `x-ad-locale-source`. `layout.tsx` sets `<html lang>` and passes the locale to `selectFonts` (the L8 gap).
- Settings `content.ui_languages` (default en) and `i18n.publish_min_percent` (80). Launch config `languages.ui` maps to `content.ui_languages`.
- `assertSupportedLanguage` in `packages/viewer/src/profiles.ts` guards profile create and update.
- Gap: `accounts.locale` is not read by `getLocale` (session has no field). `production-env.test.ts` fails on main from the Paystack variables (not this lane).

## Slice 5
- `@ad/ui` `LanguagePicker` (radio menu, endonym plus English name, 44px rows, label folds under 240px, hidden below two locales) and `Icon` `globe`. `TopNav` gets a `trailing` slot (hidden on kids profiles). `GuestChrome` and `ViewerChrome` take a `languagePicker` node, built in `Shell.tsx` from `lib/i18n/picker-data.ts`.
- `lib/i18n/set-language.ts` (`setLanguage`, tested) and `app/actions-language.ts` (`setLanguageAction`). `components/i18n/LanguagePickerHost.tsx`.
- `ProfileForm` language options come from `content.ui_languages` (prop `languages`).
- Not done here: the player `t` prop moves to wave D of slice 7. Design review was a self check against the skill list (tokens only, 44px, hover guarded, no motion); no screenshot pass.

## Slice 6
- Most font work was already merged by L8 (vietnamese subsets, `selectFonts(key, lang)`, coverage manifest and NFD aware tests with Hausa and naira). This slice adds `--leading-marks` and the `:lang(yo|ig|ha|pcm)` rules in `packages/ui/src/tokens.css` and `components.css`, Inter right after Space Grotesk and Lora in `packages/theme/src/css.ts`, and the cue stack `var(--font-sans), Inter, sans-serif` in `player.css`. DESIGN-SYSTEM 5.3 has the rule.
- Tests: `packages/ui/test/lang-marks.test.ts`, `packages/player/src/captions-css.test.ts`, `packages/theme/src/css.test.ts`.
- Not added: a fontkit based checker (the L8 manifest script covers it), the theme editor Fixed group entry for the new token.

## Slice 7 (waves, in progress)
- Wave A1 (shell chrome): `ViewerChrome`, `GuestChrome`, `Shell`, `KidsExitDialog` moved to keys `nav.*` and `kidsExit.*` and added to the D-158 lint list. Client components call `const msg = useT()` (so the literal key rule and the coverage test still see `msg('key')`); server components use `await getTranslator(await getLocale())`.
- Root layout now mounts `I18nProvider` with `CLIENT_NAMESPACES` (`lib/i18n/namespaces.ts`). Add a namespace there when a wave moves client copy.
- Test: `apps/web/src/lib/i18n/pseudo-render.test.tsx` renders wave components in the pseudo catalog.
- Left for later waves: strings that live inside `@ad/ui` components (TopNav aria labels, SiteFooter, States), home rows, cards, hero, browse, search, title, account, auth, profiles, player menus.
## Slice 8 (`@ad/i18n`)
- `packages/i18n`: `summarize` and `hashText` (status.ts, core keys by prefix list `CORE_PREFIXES`), `TranslationStore` with `MemoryStore` and `DbStore(db, actor?)`, `CatalogCache` (version bump), `TranslationService` (save, approve, approveMany, publish with threshold and Super admin override, unpublish; audit and settings are injected).
- Permissions in `apps/web/src/lib/admin/can.ts`: `i18n.edit` (editor), `i18n.approve` and `i18n.publish` (admin), `i18n.override` (super admin).
- Tests: `pnpm vitest run packages/i18n` (the DbStore test needs `TEST_DATABASE_ADMIN_URL`).
- Not wired yet: the web runtime that builds the service and registers the cache as the catalog overlay (done with the admin screens in slice 10).

## Slice 9 (export and import)
- `packages/i18n`: `csv.ts` (BOM, quotes, NFC), `export.ts` (`exportCsv`, `exportJson` effective catalog), `import.ts` (`planImport`, 5,000 rows, 2 MB, rows land `in_review`, plural cells are JSON objects), `TranslationService.exportCsv/exportJson/importCsv({dryRun})`, `store.upsertMany` (one transaction in `DbStore`).
- Web: `lib/i18n/language-routes.ts` (`createLanguageHandlers`), `lib/i18n/runtime.ts` (`translationServiceFor(actor)`, `i18nRuntime()` which also registers the approved rows as the catalog overlay), routes `GET /api/admin/languages/[locale]/export?format=csv|json` and `POST .../import?dryRun=1` (body is the CSV text, same origin, 2 MB cap, staff only).
- Tests: `pnpm vitest run packages/i18n apps/web/src/lib/i18n/language-routes.test.ts`.

## Slice 10 (admin Languages screens)
- Pages: `/admin/languages` (table with state, approved percent, missing, stale, in review, Live switch with the threshold reason, Super admin "Publish anyway" with a reason, export links) and `/admin/languages/[locale]` (workspace: Missing, Stale, In review, Approved, All tabs, search, area filter, per row editor with placeholder chips, plural categories of the locale, Copy English, validation under the field, Save, bulk approve for Admin with count and warning, Import CSV dialog with dry run). Nav entry "Languages" (action `i18n.edit`).
- Code: `lib/i18n/admin-data.ts` (pure builders), `lib/i18n/admin-queries.ts`, `components/admin/languages/*`, `app/admin/(shell)/languages/actions.ts`. The "Viewer hits" tab is built in `Workspace` (prop `missingHits`) and fed in slice 11.
- Tests: `apps/web/src/components/admin/languages/*.test.tsx`, `apps/web/src/lib/i18n/admin-data.test.ts`.
- Not done: mockup pixel pass and mobile review (self checked: admin tokens, 44px switch and checkbox, icon plus word status); plan name `languages.fixture.ts` is replaced by the memory runtime in fixture mode.

## Slice 11 (missing key sink and report)
- `packages/i18n/src/missing.ts`: `MissingKeySink` (batched, flush once a minute per process, bots and prefetch ignored, only enabled non default locales, 500 pending cap, failed flush keeps hits), `DbMissingStore` (writes through `record_missing_key`, `list(locale)` for staff), `MemoryMissing`.
- Web: the sink is registered by `lib/i18n/runtime.ts`; `getTranslator` passes user agent and prefetch hints; `getLocale` refreshes the enabled list the sink uses. Workspace "Viewer hits" tab lists keys by hits and links each key to its row (`?q=`).
- Tests: `packages/i18n/src/missing.test.ts`, `missing.int.test.ts`, `Workspace.test.tsx`.

## Slice 12 (translation adapter) and 12b (usage cap)
- `packages/video/src/captions/translate`: `Translator` interface, `translateTexts` (batches of 20, cue by cue fallback), glossary (`applyGlossary`), `GoogleTranslator`, `FakeTranslator`, usage cap. `apps/worker/src/translator.ts` `chooseTranslator(env, usage?)`: provider none refuses every job, `google` is always wrapped by `withUsageCap`, no usage store means not configured.
- 12b: `withUsageCap`, `DbUsageStore`, `MemoryUsageStore`, `monthStart` in `usage.ts`. D-292. Not built: NLLB, LLM adapter and the `apps/translate` sidecar (D-289, ruling R23).
- Tests: `pnpm vitest run packages/video/src/captions/translate apps/worker/src/translator.test.ts`, int: `usage.int.test.ts` with `TEST_DATABASE_ADMIN_URL`.

## Slice 13 (caption.translate)
- Queue `caption.translate` (payload `videoId`, `targetLanguage`, `sourceCaptionId?`, `mode new|retranslate`). `CaptionTranslator` in `packages/video/src/captions/translator-job.ts` (`reflowCueText`). `ensureTrack` takes `{kind, published, isDefault}`; `storeRevision` takes `sourceCaptionId` and `sourceSha256`.
- `CaptionService`: `requestTranslation`, `estimateTranslation`, `translationState` (computed Source changed). Deps `translation` (capability of the engine) and `captionLanguages` (`content.languages`). The web wiring of those two deps comes with the admin caption screens (slice 15).
- Worker: `translate-handlers.ts` (`registerTranslateHandlers`), `runtime.ts` `buildTranslateDeps`, notifier `translationReady` and `translationFailed`. Setting `translation.glossary` added to the registry.
- Tests: `pnpm vitest run apps/worker/src/translate-handlers.test.ts packages/queue/src/definitions.test.ts`; int: `translator-job.int.test.ts`, `service-translate.int.test.ts`, `apps/worker/src/notifier.int.test.ts`.

## Slice 14 (publish switch, viewer track lists, player t prop)
- `CaptionService.setPublished(actor, videoId, language, published)` (Admin, audited), `publicCaptions` filters on published and `content.languages`. `DrizzlePlaybackStore.captions` applies the same rule. `packages/catalog/src/caption-visibility.ts` `viewerTrackSql(alias)` feeds the CC badge (`videos.ts`, `titles.ts`) and the detail track list.
- Player: `packages/player/src/t.tsx` (`PlayerTProvider`, `usePlayerT`), `t` and `uiLanguage` on `Player`, `PlayerView` and `PlayerControllerOptions`. Controller default track order and the English fallback toast (`player.captions.fallback`). `CaptionRows` shows Off from the catalog and each language by its own name with `lang`. `WatchClient` passes `useT()` and `useLocale()`; `player` joined `CLIENT_NAMESPACES`.
- Still literal in the player (wave D, later slice): Play, Pause, Mute, Unmute and the ShortcutsDialog, SeekBar, EndScreen and caption appearance copy.
- Tests: `pnpm vitest run packages/player apps/web/src/features/player/WatchClient.language.test.tsx`; int: `service-publish.int.test.ts`, `captions-badge.int.test.ts`, `captions-switch.int.test.ts`.
- Known: `messages-coverage.test.ts` "no unused key" fails on main for `engage.mostLiked` and `sponsor.*` keys (other lanes), not this lane.

## Slice 15 (admin caption screens by language)
- Catalog `listAdminCaptionRows` returns `spokenLanguage` and `translations` chips. Web `CaptionService` interface: optional `language` on track, save, approve, upload; new `translate`, `estimate`, `setPublished`. Real implementation in `lib/data/admin/real/captions.ts` (`translationTrack`, `approveTranslation`); fixtures are English only and refuse translate and publish.
- Components in `components/admin/captions/`: `TranslationChips`, `LanguageTabs`, `TranslationPublishSwitch`, `AddTranslationDialog`, `TranslationTools`. `CaptionReview` shows source cues, Unlock timing, Source changed banner with Retranslate. `CaptionList` language filter (`?lang=`). Permissions `caption.translate` and `caption.publish_language`. Env `TRANSLATE_PROVIDER` on the web too.
- Not done: Still correct action, API routes unchanged (they are by caption id so already language agnostic), mobile pass by screenshot. `captionState` follows the spoken language since slice 16.
- Tests: `pnpm vitest run apps/web/src/components/admin/captions apps/web/src/components/admin/CaptionReview.test.tsx apps/web/src/components/admin/CaptionTable.test.tsx apps/web/src/components/admin/CaptionList.test.tsx`; int: `catalog/src/admin/captions.int.test.ts`, `real/captions.int.test.ts`.

## Slice 16 (spoken language, multilingual Whisper, detection)
- Whisper: `WHISPER_MODEL_MULTI` routes non-English and `auto`, 422 when unset; `language_probability` returned. Adapter maps 422 to a permanent plain error. Generator passes the real `videos.language` (the hardcoded en was a bug), pcm decoded as en, ig refused, auto at 0.6 or more updates `videos.language` and notes Detected X.
- Catalog: `captionState` and nav counts follow the spoken language; publish gate needs an approved track in the spoken language; `updateAdminVideo` validates `language` (locale code or auto). Video details has a Spoken language select. D-328.
- Tests: `python3 -m unittest test_server test_requirements` in apps/whisper; `packages/video/src/captions/adapter.test.ts`, `generator.int.test.ts`; `packages/catalog/src/publishing.int.test.ts`, `admin/videos.int.test.ts`; `apps/web` `video-commands.test.ts`, `VideoEditor.test.tsx`.

## L7c (finishing build, worktree `/home/claude/wt2/L7c-build`)
- Remaining order: (1) layout lang test, (2) slice 17, (3) extraction waves, (4) draft catalogs, (5) slice 18 and docs, (6) coverage failures.
- (1) done: `layout.tsx` already passed the locale to `selectFonts` (slice 4); `layout.test.tsx` now pins it with a spy and checks `html lang`. No code fix was needed.
- (2) slice 17 done (D-337). Mailer: `renderTemplate(name, vars, brand, {locale, catalog})`, viewer templates read `mail.*` keys (`packages/shared/src/messages/mail-messages.ts`) with per key English fallback; staff templates (`ENGLISH_ONLY`) stay English. `MailerSettings.localization(address)` is wired in `apps/web/src/server/email/localization.ts` (address hash to `accounts.locale`, enabled languages only). The worker mailer (digests) is not wired, so digests are English. Subjects carry no em or en dash (test).
- `getLocale` now reads `accounts.locale` (`lib/i18n/account-locale.ts`), treating the default `en` as not chosen; the picker writes it through `setLanguage`'s optional `saveAccount`.
- Offline page: `components/pwa/OfflineCopy.tsx` (table of every enabled language, picks `localStorage ad:locale`, English fallback), `lib/i18n/stored-locale.ts`, picker writes the key. Keys `offline.*` live in `l7-messages.ts` (my own file for extraction waves, spread into `EN_NG`). SavedPageLinks text and the page title are still English literals.
- `messages-coverage.test.ts` key regex now allows underscores and scans `packages/mailer/src`; that cleared the sponsor.label.* and mail.* keys from the unused list.
- Tests: `pnpm vitest run packages/mailer apps/web/src/server/email apps/web/src/lib/i18n/get-locale.test.ts apps/web/src/lib/i18n/account-locale.test.ts apps/web/src/lib/i18n/set-language.test.ts apps/web/src/lib/i18n/stored-locale.test.ts apps/web/src/components/pwa/OfflineCopy.test.tsx`.
- Note: `layout-lang.test.tsx` already pinned `selectFonts(key, 'yo')`; the layout test added in step (1) duplicates that, harmless.
- (3a) Player wave D done: Play, Pause, Mute, Unmute, Loading, Buffering, seek bar label and chapter text, spoken time units (`spokenTime(seconds, msg)` now plural aware), end screen, shortcuts dialog (rows carry an `id`, key names translated), caption appearance options, Normal and On/Off. Keys in `l7-messages.ts` under `player.*`. `format.ts`, `SeekBar`, `ShortcutsDialog`, `EndScreen`, `CaptionAppearance`, `Menus`, `SettingsMenu`, `SkipButton`, `StillWatching` joined the lint list (allow list has `S` and the three key names). The lint rule now also flags one word labels: ternary branches inside aria-label, title and similar, and `label`, `title`, `hint`, `description`, `text`, `heading` properties with a capitalised value. Not caught by the rule and still literal in the player: nothing known. Test: `pnpm vitest run packages/player/src/ui/wave-d.t.test.tsx scripts/no-hardcoded-copy.test.ts`.
- Slice 17 PR was 373 (decision number ended as D-337 after a renumber on rebase).
