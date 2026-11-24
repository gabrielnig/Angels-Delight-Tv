# Lane L6 build notes (module M45, discovery, SEO, consent and search)

Plan: `docs/plan/v2/L6-discovery.md`. Rulings: `docs/plan/v2/RULINGS.md`. Review: `docs/reviews/v2/L6-review.md`. Worktree: `/home/claude/wt2/L6-build`. Branch per slice `l6/sN-...`.

## Slices

| # | Slice | State | PR |
|---|---|---|---|
| 1 | Sitemap and robots line | merged | #283 |
| 2 | Structured data (JSON-LD), kids only noindex | merged | #292 |
| 3 | Share images and metadata | merged | #296 |
| 4 | Discovery tab, settings, robots and layout metadata | merged | #305 |
| 5 | Share menu | merged | #308 |
| 6a | Search core: migration 0043, corrections, synonyms, subjects, misses | merged | #314 |
| 6b | Search service, API, UI notes, misses pruning in worker | merged | #320 |
| 7 | Storage notice (S138), storage inventory, notice and toast placement | merged | #332 |
| 8 | Error pages (S139), one action each (R39) | merged | #339 |
| 9 | Discovery tab: synonyms editor with error lines, empty search report | merged | #342 |
| 10 | Kids only titles: share image noindex header, sitemap category fix; social image contrast already tested | in review | |

## Slice 1 (sitemap)

- `packages/catalog/src/sitemap.ts`: `listSitemapRows(db, now)` returns `{ videos, series, categories }` of `{ slug, lastmod }`. Live, ready, published (or scheduled and due), not trashed, standalone videos that are not kids only (D-269).
- `apps/web/src/lib/seo/sitemap.ts`: `buildSitemapEntries(origin, rows)`, `chunkEntries`, `SITEMAP_CHUNK_SIZE` 5000, `MAX_URL_LENGTH` 2048. `sitemap-xml.ts` renders the XML.
- `apps/web/src/server/seo/sitemap-handlers.ts`: `createSitemapHandlers({ load, origin })` with `index` and `chunk`. Wired in `sitemap-data.ts`, routes `app/sitemap.xml/route.ts` and `app/sitemaps/[id]/route.ts` (D-268).
- `robots.ts` names `${APP_ORIGIN}/sitemap.xml` whenever the origin is set.
- Scoped tests: `pnpm vitest run apps/web/src/lib/seo apps/web/src/server/seo apps/web/src/app/robots.test.ts packages/catalog/src/sitemap.int.test.ts` (the last needs `TEST_DATABASE_ADMIN_URL`).

## Slice 2 (structured data)

- `apps/web/src/lib/seo/jsonld.ts`: pure builders `videoObject`, `tvSeries`, `breadcrumbList`, `webSiteJsonLd`, `organizationJsonLd`, `isoDuration`, `serializeJsonLd` (escapes `<`, `>`, `&`, line separators).
- `apps/web/src/lib/seo/page-jsonld.ts`: page level blocks `titlePageJsonLd`, `seriesPageJsonLd`, `homePageJsonLd`, `categoryPageJsonLd`, `thumbnailUrls`. Empty without an absolute origin.
- `apps/web/src/components/seo/JsonLd.tsx`: server component, one script per block, null blocks skipped.
- `apps/web/src/server/seo/page-seo.ts`: `siteOrigin()` (APP_ORIGIN), `titleIndexable(kind, slug)` over `isKidsOnlyTitle` in `@ad/catalog`.
- `previewMetadata` takes `indexable`; false gives `robots: { index: false, follow: false }`. Missing titles get the same.
- Decision D-278. Tests: `pnpm vitest run apps/web/src/lib/seo apps/web/src/components/seo apps/web/src/app/page.test.tsx "apps/web/src/app/(viewer)/title/[slug]/page.test.tsx" "apps/web/src/app/(viewer)/series/[slug]/page.test.tsx"` and `packages/catalog/src/sitemap.int.test.ts` (DB).

## Slice 3 (share images)

- `apps/web/src/lib/seo/og-image.ts`: geometry, `SCRIM_STOPS`, `scrimAlphaAt`, `scrimCss`, `TITLE_ZONE`, `truncateTitle`, `pickPosterUrl`, `chooseOgImage`.
- `apps/web/src/server/seo/og-render.tsx` (`renderOgJpeg`, ImageResponse then sharp jpeg under 300 KB), `og-handler.ts` (`createOgHandler`), `og-data.tsx` wiring, route `app/og/[kind]/[slug]/route.ts` (D-280). The default image is `/brand-icons/placeholder-og.png` until the admin Discovery slice wires `seo.defaultSocialAssetId` into `defaultImageUrl`.
- Message key `og.freeToWatch`. Tests: `pnpm vitest run apps/web/src/lib/seo apps/web/src/server/seo`.

## Slice 4 (Discovery settings)

- `packages/theme/src/settings-discovery.ts`: `DISCOVERY_DEFS`, `SHARE_CHANNELS`, keys `seo.site_description`, `seo.default_social_image_url`, `seo.share_text_template`, `seo.indexing`, `seo.share_channels`, `consent.notice_enabled`, `consent.notice_text`, `consent.notice_version`. Group `discovery`.
- Admin: `components/admin/site/DiscoveryTab.tsx`, `FormActions.tsx` (moved out of the view, now has `blocked`). Tab id `discovery`.
- Reader: `lib/site/seo-settings.ts` (`resolveSeoSettings`, `shareText`), `server/seo/seo-settings.ts` (`getSeoSettings`, never throws). Used by `app/layout.tsx`, `app/robots.ts` (async, `lib/seo/robots-rules.ts`) and the share image default.
- Not built: social image upload (a link for now, D-281). The synonyms editor and misses report join this tab in the search slice.
- Known: `apps/web/src/app/layout.test.tsx` first test fails on main since the locale work (`next/headers` mock lacks `cookies`); not caused by L6.
- Tests: `pnpm vitest run packages/theme/src/settings-discovery.test.ts apps/web/src/components/admin/site apps/web/src/lib/site apps/web/src/lib/seo apps/web/src/app/robots.test.ts apps/web/src/app/layout.test.tsx`.

## Slice 5 (share menu)

- `components/share/ShareMenu.tsx` (`title`, `text`, `channels`, `kind`), `share-links.ts` (`shareHref`, `withChannelTag`, `CHANNEL_TAGS`), `share.css`. `TitleActions` takes `share`, `kids`, `kind` and renders it. `shareConfig(title)` in `server/seo/page-seo.ts` reads the admin channels and text. Title and series pages pass them; kids get no Share.
- Not done: the analytics `share` channel event (waits for slice 12 posture guard), share from the player end card (Could).
- Tests: `pnpm vitest run apps/web/src/components/share apps/web/src/components/title "apps/web/src/app/(viewer)"`.

## Slice 6a (search core)

- Migration `packages/db/migrations/main/0043_search_quality.sql` (hand written, journal entry added) and Drizzle tables in `packages/db/src/schema/search.ts`: `search_terms`, `search_synonyms` (neutral seed), `search_misses`. No snapshot file was generated for 0043.
- `packages/catalog/src/search-synonyms.ts`: `parseSynonymGroups` (line numbered errors), `expansionsFor` (cap `MAX_EXPANSIONS` 8), `buildTsQueries`, `loadSynonymGroups`. `searchTitles` now expands synonyms (exact matches rank above) and only fuzzy matches titles when every word has 5 or more characters.
- `packages/catalog/src/search-quality.ts`: `refreshSearchTerms(Safe)`, `correctQuery`, `searchWithCorrection` (`showingFor`, `didYouMean`), `searchSubjects`, `replaceSynonymGroups`, `listSynonymGroups`, `recordMiss`, `pruneMisses`, `listMisses`. `publish` and `unpublish` refresh the word list.
- Left for 6b: the viewer service and API (`subjects`, `showingFor`, `didYouMean`, miss logging on empty results, guests), the search UI states, the synonyms editor and misses report in the Discovery tab, pruning misses in the worker.
- Tests: `pnpm vitest run packages/catalog/src/search-synonyms.test.ts packages/catalog/src/search-quality.int.test.ts packages/catalog/src/titles.int.test.ts packages/catalog/src/publishing.int.test.ts packages/db/src/schema.int.test.ts` (DB for the int files).

## Slice 7 (storage notice, build agent L6b)

- `apps/web/src/lib/consent/notice.ts` (`NOTICE_KEY` `ad:notice:v1`, `readNotice`, `noticeVisible`, `dismissNotice`, 12 months), `inventory.ts` (`STORAGE_INVENTORY`, `visitorInventory`, `durationText`). Every row names its `source` file and `needle`; durations come from the code constants and are checked in `inventory.test.ts`, which also scans the source for declared cookie names and keys, so a new cookie or key fails the test until it has a row.
- `components/consent/StorageNotice.tsx` (mounted in the root layout, hidden on `/watch`, publishes `--notice-h`), `StorageList.tsx` (Privacy page, anchor `#storage`), `consent.css`. Toast container CSS in `packages/ui/src/components.css` lifts by `--notice-h` below 1024. `notice-toast-geometry.test.ts` reads the stylesheets and proves the rectangles never meet from 360 to 1920.
- Settings reach the layout through `getSeoSettings` (`noticeEnabled`, `noticeText`, `noticeVersion`, `supportEmail`). The root `layout.test.tsx` first test failed since the locale work (mock lacked `cookies` and the language lookup); it belonged to L7 and is fixed here with mocks.
- Decision D-297. Tests: `pnpm vitest run apps/web/src/lib/consent apps/web/src/components/consent apps/web/src/app/layout.test.tsx apps/web/src/lib/site`.

## Slice 8 (error pages)

- `components/errors/ErrorPage.tsx` (one action, heading focus, noindex, reference and support email as plain text, optional search field), `NotFoundSuggestions.tsx` (popular titles, skeleton), `errors.css`.
- Pages: `app/not-found.tsx`, `app/(viewer)/title/[slug]/not-found.tsx` and `error.tsx`, `app/(viewer)/series/[slug]/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` (system colours, one Reload button), `app/offline/page.tsx`. `TitleNotFound` and `TitleError` were removed.
- `error-pages.r39.test.tsx` counts links and buttons in the message block of each page. Support email reaches client error pages through `AccountSupportProvider` at the root layout.
- Tests: `pnpm vitest run apps/web/src/app/error-pages.r39.test.tsx apps/web/src/app/error.test.tsx apps/web/src/components/errors apps/web/src/components/title`.

## Slice 9 (Discovery tab, search quality)

- `lib/admin/synonym-text.ts` (`checkSynonymText`: line numbered errors, repeats, server only) and `synonym-format.ts` (`groupsToText`, `dayLabel`, client safe). `lib/data/admin/search-admin.ts` (facade, fixture and real), `real/search-admin.ts` (`load`, `saveSynonyms`, audit action `search.synonyms_replace` with only the group count), types in `search-admin-types.ts`.
- `components/admin/site/SearchQualityCards.tsx`: the synonyms editor and the Searches with no results report, rendered under the Discovery tab when the page passes `search`. `Add synonym` appends a line and focuses the field. A failed load shows an error and no editor, so a save can never wipe the list from an empty field.
- The mockup Import from text button is not built: the textarea is the import (paste a list). Report loading skeleton is not needed because the page loads the data on the server.
- Fixed: `replaceSynonymGroups` now stamps `clock_timestamp()` so group order is stable.
- Already in place from slice 4 and guarded by `discovery-switches.test.tsx`: named 44 px switches, share channel switches, the Kids only never indexed line.
- Tests: `pnpm vitest run apps/web/src/components/admin/site apps/web/src/lib/admin/synonym-text.test.ts` and, with the database, `apps/web/src/lib/data/admin/real/search-admin.int.test.ts packages/catalog/src/search-quality.int.test.ts`.

## Slice 10 (kids only titles, R26)

- Already done earlier and re-checked: kids only video and series pages send `noindex, nofollow` and no JSON-LD (slice 2 tests), the sitemap leaves out kids only videos and series (D-269), Share is hidden for kids (slice 5), home and category JSON-LD hold no titles.
- New: `createOgHandler` takes `indexable` and sends `X-Robots-Tag: noindex` on the share image (and its fallback redirect) of a kids only title, and also when the lookup fails. `og-data.tsx` wires `titleIndexable`.
- Fixed: a category whose only titles were kids only series was still in the sitemap. The category query now needs a series with a public episode that is not kids only. Test in `sitemap.int.test.ts`.
- Social image contrast (4.5:1 on a white poster, title zone) was built with slice 3: `lib/seo/og-image.test.ts` (scrim maths) and `server/seo/og-render.test.tsx` (rendered pixels). No change needed.
