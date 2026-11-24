# Lane L7 build notes (module M46, languages)

Plan: `docs/plan/v2/L7-languages.md`. Rulings: `docs/plan/v2/RULINGS.md` (R23: engine off by default, NLLB is non commercial). Worktree `/home/claude/wt2/L7-build`, branch per slice `l7/sNN-...`.
Scoped tests only: `pnpm vitest run <file>`.

## Slices
| Slice | What | PR |
|---|---|---|
| 1 | Locale registry, plurals, numbers, dates, durations | 280 |
| 2 | Catalog loader, merge, validation, pseudo locale, namespaces | 284 |
| 3 | Migration 0040 and schema (ui tables, caption published, translation source) | see PR list |

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
