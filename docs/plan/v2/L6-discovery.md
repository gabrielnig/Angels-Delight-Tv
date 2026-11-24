# Lane L6 plan: Discovery, SEO, consent and search (module M45)

Status: planning pass (docs only). Base: origin/main at 08d6e86. Read with `docs/audits/2026-11-24-netflix-rea-audit.md` (section 5 SEO notes and section 4 "Missing"), `CLAUDE.md`, `docs/SECURITY.md`, `docs/DESIGN-SYSTEM.md` and the `angels-delight-design-system` skill.

Dependency on lane L1 (guest access): guests make `/`, `/browse`, `/search`, `/title`, `/series` public. Until L1 merges, search and the catalog are signed in only, so slices that touch public pages (S1, S2, S3, S8) are written against a typed `PublicCatalog` interface in `apps/web/src/lib/data/discovery.ts` with a fixture implementation behind the dev flag, then wired to the L1 account free catalog path in the last slice (S12).

## 1. Scope

In scope (Must unless marked):
1. `robots.ts` and `sitemap.ts` (dynamic, published only, lastmod, size limits, sitemap index when over 50,000 URLs or 45 MB).
2. JSON-LD: `VideoObject` on title pages, `TVSeries` with `TVEpisode` on series, `BreadcrumbList` on title, series and category pages, `WebSite` with `SearchAction` and `Organization` on Home.
3. Open Graph and Twitter images per title and series, generated from the poster (1200 by 630 crop), with a configurable site default image.
4. Canonical and hreflang readiness (single locale at launch, emitted structure ready for `en-NG`, `en`, later `yo`, `ig`, `ha`, `pcm`).
5. Admin site settings: site description, default social image, share text template, notice text, analytics posture note.
6. Share polish: native share, copy link, WhatsApp link, share text, attribution-free links (no tracking params except an optional `?s=wa`).
7. Search quality: typo tolerance, synonyms, search by subject, empty state suggestions, no results logging. Voice search via Web Speech API is Could.
8. Cookie and storage notice (functional only, NDPA aligned, remembers dismissal, configurable).
9. Analytics consent posture (documented decision, enforced by a single guard).
10. Performance budget checks (LCP image, fonts, hero) as scoped tests plus a script.
11. 404 and error pages (global, route level, not found for deleted or unpublished titles with suggestions).

Out of scope: paid SEO tooling, Search Console automation, Yoruba, Igbo, Hausa and Pidgin UI strings (hreflang only prepared), full CMP with vendor lists (no third party trackers exist), AMP.

Current code facts (evidence): `apps/web/src/lib/seo.ts` has `previewMetadata` and `largestImage` only. `apps/web/src/app/layout.tsx` sets `metadataBase` from the origin. There is no `robots.ts`, `sitemap.ts`, JSON-LD or cookie notice (audit section 4). Search: `packages/catalog/src/titles.ts` already uses `to_tsquery('simple', ad_unaccent(...))`, `word_similarity` and category text (migration 0010, GIN trigram on title), and `packages/viewer/src/search.ts` wraps it with `withAccount`, `loadOwnedProfile`, recent searches and a popular fallback. `SearchBox.tsx` keeps recent searches in `localStorage` key `ad-recent-searches`, and `TitleActions.tsx` already shares through `navigator.share` with a clipboard fallback and a manual URL field. `not-found.tsx` uses `ErrorState`. `error.tsx` is a plain `pwa-offline` page.

## 2. Build list (numbered slices)

Branch per slice from `origin/main`, TDD, scoped runs only (`pnpm vitest run <path>`), `scripts/footprint-check.sh` before commit, grep the diff for emojis and dashes. Migrations take the next free number at build time (expect 0036 and 0037, additive).

### S1. Site base URL and SEO settings (config first)
Files: new `packages/shared/src/seo-settings.ts` (zod schema and defaults), `apps/web/src/lib/site/seo-settings.ts` (reader with 5 minute cache), edit `apps/web/src/app/admin/(shell)/site-settings` form (new "Discovery" tab), `apps/web/src/lib/seo.ts` (add `siteOrigin()`).
Config keys (site settings, all optional, nothing hardcoded): `seo.siteDescription` (max 160), `seo.defaultSocialAssetId`, `seo.shareTextTemplate` (default `{title} on {siteName}`), `seo.indexing` (`on` default, `off` for staging, sends `Disallow: /` and `noindex`), `seo.sitemapEnabled`, `consent.noticeEnabled` (default on), `consent.noticeText`, `consent.noticeRegions` (`all` default or a list of country codes from the `cf-ipcountry` header), `consent.analyticsMode` (`anonymous` fixed at launch, see D-L6-3). Env: `APP_ORIGIN` already exists and is the single source for canonical, sitemap and robots URLs.
Failing tests first: `packages/shared/src/seo-settings.test.ts`: `rejects a description over 160 characters`, `fills defaults when empty`. `apps/web/src/lib/site/seo-settings.test.ts`: `falls back to the tagline when no description is set`. `apps/web/src/app/admin/(shell)/site-settings/discovery.test.tsx`: `saves description and social image and shows a live link preview`.
Migration: none if site settings are a key value store (verify in `packages/db`); otherwise `0036_seo_settings.sql` adding keys only.

### S2. robots.ts and sitemap.ts
Files: new `apps/web/src/app/robots.ts`, `apps/web/src/app/sitemap.ts`, `apps/web/src/lib/seo/sitemap.ts` (pure builder), `packages/catalog/src/sitemap.ts` (query), tests beside each.
Behaviour: `robots.ts` allows `/`, disallows `/admin`, `/api`, `/account`, `/settings`, `/profiles`, `/watch`, `/sign-in`, `/sign-up`, `/reset-password`, `/verify-email`, `/offline`, `/maintenance`, `/unsupported`, `/search?` (query pages are thin and unbounded), lists the sitemap URL, and returns `Disallow: /` when `seo.indexing` is `off` or `NODE_ENV` is not production. `sitemap.ts` uses `generateSitemaps()` to paginate at 5,000 URLs per file (well under the 50,000 URL and 50 MB limits), served at `/sitemap/[id].xml` plus an index. Entries: `/`, `/browse`, each visible category `/browse/<slug>`, each published title `/title/<slug>`, each published series `/series/<slug>`, `/about`, `/help`, `/privacy`, `/terms`. Only `publish_state = published`, not deleted, `publish_at <= now`, and general audience only (kids-only titles are excluded from the sitemap because kids content is not marketed through search, see D-L6-5). `lastmod` is `greatest(updated_at, published_at)` of the row (series: the newest episode or the series row). No `changefreq` or `priority` (ignored by Google). Slug redirects (`slug_redirects`) never appear. Query is one indexed statement with keyset paging, cached 1 hour through the existing catalog cache and revalidated by the publish and unpublish hooks (`revalidateTag('sitemap')`).
Failing tests first: `apps/web/src/app/robots.test.ts`: `disallows admin api and account paths`, `points to the sitemap on the configured origin`, `blocks everything when indexing is off`. `apps/web/src/lib/seo/sitemap.test.ts`: `lists only published titles`, `omits unpublished trashed and scheduled titles`, `omits kids only titles`, `sets lastmod from the newest change`, `splits into files of 5000 urls`, `never emits a url longer than 2048 characters`. `packages/catalog/src/sitemap.int.test.ts` (DB): `unpublishing a title removes it from the next build`, `slug redirect old slugs are absent`.

### S3. Structured data (JSON-LD)
Files: new `apps/web/src/lib/seo/jsonld.ts` (pure builders), `apps/web/src/components/seo/JsonLd.tsx` (server component, `<script type="application/ld+json">` with `<` escaped as `<` to prevent script breakout), edit title and series pages under `apps/web/src/app/(viewer)/title` and `series`, Home `apps/web/src/app/page.tsx`.
Shapes: `VideoObject` (`name`, `description`, `thumbnailUrl[]` from poster renditions, `uploadDate` ISO with offset, `duration` ISO 8601 `PT#M#S`, `contentUrl` omitted because media is signed and short lived, `embedUrl` is the title page, `isAccessibleForFree: true`, `inLanguage`, `publisher` Organization with logo, `hasPart` omitted, caption `caption` link omitted). Google requires `name`, `thumbnailUrl`, `uploadDate`; the others are recommended. Series: `TVSeries` with `numberOfEpisodes` and `episode[]` capped at 50 as `TVEpisode` (`name`, `episodeNumber`, `url`). `BreadcrumbList` Home > Category > Title. `WebSite` with `potentialAction` `SearchAction` target `/search?q={search_term_string}` (only emitted when guest search is on). Descriptions are plain text, truncated at 5,000 characters, never HTML. No `aggregateRating` (no ratings exist, and fabricated ratings violate Google policy).
Failing tests: `jsonld.test.ts`: `video object has name thumbnail and upload date`, `duration is ISO 8601`, `escapes script breakout in titles`, `omits fields that have no value instead of emitting empty strings`, `series lists at most 50 episodes`, `breadcrumb positions start at 1`, `no rating is ever emitted`. `title-page-seo.test.tsx`: `unpublished title renders no json ld and noindex`.

### S4. Social images per title
Files: new `apps/web/src/app/(viewer)/title/[slug]/opengraph-image.tsx` and `series/[slug]/opengraph-image.tsx` (Next ImageResponse, 1200 by 630, poster as cover with a bottom scrim, title text, site name, `Free to watch` line from config), `apps/web/src/lib/seo/og-image.ts` (pure layout and fallback choice), edit `seo.ts` `previewMetadata` to prefer the generated image and fall back to `seo.defaultSocialAssetId`, then a bundled neutral placeholder.
Rules: WhatsApp, Facebook and X crop to roughly 1.91:1, keep text in the central 80 percent. Images under 300 KB for WhatsApp, which silently drops large previews: output JPEG quality 80 through the existing derivative pipeline when a 1200 by 630 rendition exists (`packages/catalog/src/artwork.ts`), otherwise ImageResponse. Cache with `Cache-Control: public, max-age=86400, stale-while-revalidate`. Unpublished titles return 404 so previews never leak drafts. Poster must not be a signed URL (signed URLs expire and break old shares); use the public artwork path already used by `previewMetadata`.
Failing tests: `og-image.test.ts`: `uses the poster when present`, `falls back to the site default then the placeholder`, `title text is truncated to two lines worth of characters`, `refuses unpublished titles`. Extend `apps/web/src/lib/seo.test.ts`: `twitter card is summary_large_image when an image exists`, `og locale and alternates are present`.

### S5. Canonical and hreflang readiness
Files: new `apps/web/src/lib/seo/alternates.ts`, edit `previewMetadata` and Browse, Search, Home metadata.
Rules: every public page sets an absolute canonical (via `metadataBase`) with tracking params (`utm_*`, `s`, `fbclid`) and sort or filter params stripped. `/browse?sort=...` canonicalises to `/browse`. `/search` is `noindex,follow`. Paginated pages (`?cursor=`) are `noindex,follow` and canonical to page one. `alternates.languages` is built from `LOCALES` in `@ad/shared` (today `['en']`) and emits `x-default` plus `en-NG` only when more than one locale is enabled, so nothing is emitted that points at a page that does not exist. `<html lang>` follows the active locale.
Failing tests: `alternates.test.ts`: `strips tracking params`, `sort and filter params canonicalise to the base page`, `emits no hreflang with one locale`, `emits x-default and each enabled locale when several exist`, `search pages are noindex`.

### S6. Share polish
Files: new `apps/web/src/components/share/ShareMenu.tsx`, `share-links.ts`, `share.css`; edit `apps/web/src/components/title/TitleActions.tsx` to use it (existing tests in `TitleActions.test.tsx` stay green).
Behaviour: Share button opens `navigator.share({title, text, url})` when available (phones). Where it is not (desktop), a popover lists Copy link (clipboard with the existing manual-URL fallback), WhatsApp (`https://wa.me/?text=<encoded text and url>`), Facebook, X, and Email (`mailto:`). WhatsApp is listed first and, on devices with `navigator.share`, native share already includes it. Text comes from `seo.shareTextTemplate`, so the client can localise tone. Link gets `?s=wa|fb|x|em|cp` only for first party analytics of the share channel (event `share`, props `channel`, no PII, honours the analytics posture); canonical strips it. Kids profiles: share hidden (no external links, PRD kids rule). Share also on series pages and from the player end card (Could). Links open with `rel="noopener noreferrer"`, `target="_blank"`, and visible "Opens in a new tab" for screen readers.
Failing tests: `share-links.test.ts`: `builds a whatsapp link with encoded text and url`, `appends the channel tag only once`, `escapes ampersands and hashes in titles`. `ShareMenu.test.tsx`: `uses native share when available`, `shows copy and whatsapp when native share is missing`, `copy shows a Link copied toast`, `falls back to a selectable field when clipboard is blocked`, `menu closes on Escape and returns focus`, `is hidden for kids profiles`, `ignores AbortError from a cancelled native share`.

### S7. Search quality (typo tolerance, synonyms, subjects, empty state)
Files: edit `packages/catalog/src/titles.ts` (`searchTitles`, `suggestTitles`), new `packages/catalog/src/search-synonyms.ts`, new `packages/catalog/src/search-subjects.ts`, edit `packages/viewer/src/search.ts` and `apps/web/src/components/browse/SearchScreen`/`SearchBox.tsx`, migration `0036_search_synonyms_and_misses.sql`.
Design, all in Postgres, no external engine:
- Typo tolerance: keep `word_similarity` on titles and add trigram candidates for each query token against a `search_terms` vocabulary table (lowercased unaccented words from titles, categories, subjects), so `budgetng` corrects to `budgeting` before the `to_tsquery` is built ("did you mean" when the corrected query returns results and the raw one returns fewer than 3). Threshold `pg_trgm.similarity_threshold` 0.3 for words of 5 or more characters, exact match only for 3 and 4 (short words produce noise). Index: `GIN (term gin_trgm_ops)` on `search_terms`, kept current by a trigger on publish and by `refreshSearchTerms()` in the publish hook. Existing GIN trigram index on `videos.title` stays.
- Synonyms: table `search_synonyms(term, synonyms text[], is_active)` managed in admin (M29 Discovery tab, import from a textarea, one group per line `money, finance, cash, budget`). Query expansion is applied to the tsquery as an OR group and is capped at 8 expansions per query. Seed a small neutral set for the education domain (see failing test) that the client can edit. Stored in the DB so no deploy is needed.
- Search by subject: the existing `category_text` already matches category names; add `subjects` (the categories plus series title plus tags if M33 adds tags) as a weight `B` field and a "Subjects" chip row above results (top 5 matching visible categories, each linking to `/browse/<slug>`). A query that exactly matches a category name returns that category row first.
- Ranking: title match (A) over description (B) over subject (B, lower) then recent views as tie break (existing). Pidgin and Yoruba words are not stemmed (`simple` config, already so; test pins it).
- Empty state: "No results for 'xyz'" with tips, "Did you mean" link, subject chips (popular categories) and the popular titles row (already returned as `popular`). Kids profiles get kids-safe only (existing audience filter).
- No result logging: table `search_misses(query_norm, count, last_seen)` with no profile id, no account id, no IP, upsert on empty result only, query normalised and capped at 80 characters, pruned at 90 days; feeds the admin M19 "searches with no results" report and the synonyms editor.
- Guests: `search()` gets an account free path with audience argument from L1 (`searchPublic`), rate limit per IP (60 a minute already specified in M06-S10) and per guest session.
Failing tests first: `packages/catalog/src/titles.int.test.ts` additions: `corrects budgetng to budgeting`, `does not fuzzy match words under 5 characters`, `expands money to finance titles through synonyms`, `caps synonym expansion at 8`, `a category name returns that category first`, `pidgin words are matched without stemming`, `kids audience never returns non kids titles for a corrected query`. `packages/catalog/src/search-synonyms.test.ts`: `parses one group per line`, `rejects groups with a single term`, `lowercases and unaccents terms`. `packages/viewer/src/search.int.test.ts`: `records a miss without any identifier`, `prunes misses older than 90 days`, `returns subjects for a category word`. `SearchScreen.test.tsx`: `shows did you mean with a link`, `empty state shows tips subject chips and popular titles`.
Migration `0036`: `search_terms`, `search_synonyms`, `search_misses`, their indexes, RLS off (no per-account data, reached only by catalog and admin services, add to the "no policies" list in DATA-MODEL.md).

### S8. Voice search (Could)
Files: new `apps/web/src/components/browse/VoiceSearchButton.tsx`, `voice.ts` (feature detection), edit `SearchBox.tsx` to show it only when `window.SpeechRecognition || window.webkitSpeechRecognition` exists and the connection is not Data saver.
Rules: language `en-NG` first then `en-US`; the browser sends audio to its vendor, so the first tap shows a one line disclosure "Your browser may send what you say to its speech service" with Continue and Cancel (remembered in `localStorage` `ad:voice:ok`); never auto-start; interim results fill the box, final result submits after 600 ms; permission denied, no speech and network errors each have a plain message; the button is a toggle with `aria-pressed`, a listening state with a pulse that stops under reduced motion (replaced by a static ring), and 44 px target. Hidden for kids profiles.
Failing tests: `voice.test.ts`: `detects the standard and prefixed constructors`, `returns unsupported in non browser environments`. `VoiceSearchButton.test.tsx`: `is not rendered when unsupported`, `shows the disclosure on first use only`, `fills the box with interim text`, `maps not-allowed to a permission message`, `stops listening on Escape`, `is not rendered under data saver`.

### S9. Cookie and storage notice
Files: new `apps/web/src/components/consent/StorageNotice.tsx`, `consent.css`, `apps/web/src/lib/consent/notice.ts` (state machine and storage), edit `apps/web/src/app/layout.tsx` to mount it once, edit `apps/web/src/app/(site)/privacy` to list the storage inventory from one typed constant `STORAGE_INVENTORY` in `apps/web/src/lib/consent/inventory.ts` (so the notice, the privacy page and the tests share one list).
Posture (see D-L6-2, D-L6-3): everything the site stores is strictly necessary or functional: session cookie `__Host-ad_session`, `ad_profile`, the `ad_guest` cookie from L1 (functional, for playback continuity and rate limiting, 180 days), `ad:guest:progress:v1`, `ad-recent-searches`, Data saver and theme preferences, the service worker cache, and a first party anonymous analytics id that is a daily rotating hash, not a persistent identifier. No advertising or third party trackers exist. Under the NDPA 2023 (and NDPR) consent is needed for processing personal data on a consent basis; strictly functional storage does not need a choice, but transparency does. So the notice is an information banner, not a consent wall: one sentence, "Got it" button, link to Privacy, no "Reject" or "Accept all" (there is nothing to reject), and it must never block playback. Dismissal is stored in `localStorage` key `ad:notice:v1` with `{version, at}`; the notice returns when `consent.noticeVersion` changes (admin bumps it when the text or inventory changes) and after 12 months. Where storage is blocked the notice shows each visit but never errors. Text from `consent.noticeText` with a safe default. Regions: shown to everyone by default (Nigeria first, and the same text satisfies UK and EU transparency for diaspora); `consent.noticeRegions` can narrow it. The notice is rendered server side hidden by default and revealed by a client check to avoid layout shift: it is `position: fixed` bottom, not in flow, so CLS stays 0, and does not cover the mobile bottom tab bar (sits above it using the safe area inset and tab bar height token).
Consent guard for the future: `apps/web/src/lib/consent/guard.ts` exports `canUse(category)` with categories `necessary`, `functional`, `analytics-identified`, `marketing`. Only the first two return true; adding any third party script must go through it and requires a new decision. This keeps the posture enforceable in tests.
Failing tests: `notice.test.ts`: `shows when never dismissed`, `hides after dismissal`, `returns when the version changes`, `returns after 12 months`, `survives blocked storage`. `StorageNotice.test.tsx`: `shows the configured text and a privacy link`, `Got it dismisses and remembers`, `has no reject or accept all buttons`, `does not trap focus and does not block the page`, `is announced politely with role region and an accessible name`, `does not render when disabled in config`, `does not render outside configured regions`. `inventory.test.ts`: `every storage key used in src appears in the inventory` (greps `localStorage` and `document.cookie` and `cookies().set` usages), `privacy page lists every inventory item`, `no inventory item is marketing`. `guard.test.ts`: `denies analytics-identified and marketing`.

### S10. Analytics consent posture
Files: edit `apps/web/src/lib/analytics/browser.ts` only to read `canUse('functional')`; no new tracker. Document in SECURITY.md and the privacy text.
Rules: first party analytics only, anonymous (daily hash of the guest or account id per L1, no IP stored, kids profiles `profile_id` null), no cross site tracking, no fingerprinting. Honour Global Privacy Control and `Do Not Track` anyway: when `navigator.globalPrivacyControl` or `doNotTrack === '1'`, the client skips the `search` and `share` channel events (playback health telemetry stays because it is operational). A Privacy page section "What we count and why" plus an inventory table generated from `STORAGE_INVENTORY`. If the owner later adds a third party analytics tool, the notice upgrades to a real choice banner (Accept and Reject equal prominence) behind the same guard, which is a pre-built but disabled code path only described here, not built (D-L6-3).
Failing tests: `analytics-posture.test.ts`: `skips share and search events when gpc is set`, `keeps playback health events`, `no third party script origin appears in the layout`, `analytics id is not persisted in storage`.

### S11. Performance budget checks
Files: new `scripts/perf-budget.mjs`, `apps/web/src/lib/perf/budget.ts`, `apps/web/src/lib/perf/budget.test.ts`, `docs/` note appended to `docs/DEPLOYMENT.md` is left to the integration pass.
Budgets (mobile, 4G throttled, Moto G class): LCP at most 2.5 s on Home, title and search; CLS at most 0.1; INP at most 200 ms; first load JS at most 170 KB gzip per route (Next build output parsed); hero and title poster `<Image priority fetchPriority="high" sizes>` only on the first slide and never lazy; all other images `loading="lazy"` with explicit `width` and `height` or `aspect-ratio`; at most 2 font families and 4 font files preloaded (`font-display: swap`, subset Latin, `size-adjust` fallback to avoid shift); no render blocking third party. Notice, share popover and voice button are client chunks loaded after interaction or idle (`next/dynamic`, `ssr: false` for voice only).
Failing tests: `budget.test.ts`: `fails when a route exceeds the js budget`, `fails when the hero image is lazy`, `fails when an image lacks dimensions`, `fails when more than four fonts are preloaded`, `passes the current build manifest`. Scoped static test `apps/web/src/app/layout.test.tsx` addition: `preloads at most four font files`.

### S12. 404 and error pages
Files: edit `apps/web/src/app/not-found.tsx`, `apps/web/src/app/error.tsx`, new `apps/web/src/app/global-error.tsx`, new `apps/web/src/components/errors/NotFoundSuggestions.tsx`, new `apps/web/src/app/(viewer)/title/not-found.tsx` and `series/not-found.tsx`, `apps/web/src/lib/data/discovery.ts` wired to the L1 public catalog at the end of this slice.
Behaviour: global 404 keeps the shell header and footer, offers Search box, Home, Browse, and a popular titles row (cards with skeletons). Title or series not found shows "This video is no longer available" (unpublished or deleted) with a search box, "More like this" by category when the old slug resolves in `slug_redirects` or the id is known, and returns HTTP 404 (410 when permanently trashed, Could). The error page moves to design system `ErrorState` (today it is a bare `pwa-offline` layout), keeps the digest as "Reference", adds Try again, Home, and "Report this" mailto using the configured support email with the reference prefilled; `global-error.tsx` provides a minimal, token-light page for root layout failures (inline critical CSS, no data). Both set `noindex`. Messages never expose raw errors. Offline: the service worker already serves `/offline`; 404 and error pages are static enough to cache.
Failing tests: `not-found.test.tsx` additions: `shows search home and browse actions`, `keeps the site header`, `shows popular titles when available and survives their failure`. `error.test.tsx` additions: `shows the reference and a support mailto with the reference`, `uses the error state component`, `Try again calls reset`. `global-error.test.tsx`: `renders without the app shell or data`. `title/not-found.test.tsx`: `says the video is unavailable and offers search`, `returns noindex`.

Order and PR plan: S1, S2, S3, S4, S5 (SEO core, 3 PRs), S6 (share), S7 (search, 2 PRs: S7a typo and synonyms with migration, S7b empty state and misses), S9 and S10 (consent), S12 (errors), S11 (budget script last because it measures everything), S8 (Could) last. Lane notes go to `docs/lanes/L6.md`.

## 3. Stories for module M45 (Discovery, SEO and consent)

Add `## M45 Discovery, SEO and consent` to `docs/USER-STORIES.md` after the last module, and add M45 to `docs/MODULES.md` ([READY], depends on M06, M07, M26, M29, M19, M34, and L1 guest access).

### M45-S01 Robots and sitemap (Must)
As the owner, I want search engines to find every published title and nothing private, so that people discover the platform.
- AC1: Given the site is live, When `/robots.txt` is requested, Then it allows public pages, disallows `/admin`, `/api`, `/account`, `/settings`, `/profiles` and `/watch`, and names the sitemap on the configured origin.
- AC2: Given `/sitemap.xml`, When requested, Then it lists the home page, categories, published titles, published series and legal pages with `lastmod`, and no more than 5,000 URLs per file.
- AC3: Given I unpublish or trash a title, When the sitemap next builds (within 1 hour or on publish), Then the title is absent.
- AC4: Given the environment is staging or `seo.indexing` is off, When robots is requested, Then it returns `Disallow: /` and pages carry `noindex`.
- Edge: scheduled titles appear only after their publish time. Old slugs from redirects never appear.
- Error: if the catalog query fails, the sitemap returns 503 with `Retry-After`, never an empty 200.
- Empty: with no published titles the sitemap lists only the static pages.

### M45-S02 Structured data (Must)
As the owner, I want rich results for videos, so that titles show with a thumbnail and length in search.
- AC1: Given a published title page, When the HTML is read, Then it contains one valid `VideoObject` with name, description, thumbnail, upload date and ISO 8601 duration.
- AC2: Given a series page, When read, Then it contains `TVSeries` with up to 50 episodes, and a `BreadcrumbList`.
- AC3: Given any title with quotes, angle brackets or script text, When rendered, Then the JSON-LD is escaped and cannot break out of the script tag.
- Edge: missing optional fields are omitted, never empty. No ratings are ever emitted.
- Error: if the data cannot be built, the page renders without JSON-LD.
- Empty: not applicable.

### M45-S03 Share previews (Must)
As a viewer, I want a shared link to show the title, picture and a short line in WhatsApp, so that friends know what they are opening.
- AC1: Given a published title link pasted into WhatsApp, Facebook or X, When the preview loads, Then it shows the title, description and a 1200 by 630 image made from the poster.
- AC2: Given no poster exists, When previewed, Then the site default social image from admin shows.
- AC3: Given an unpublished title, When its image URL is requested, Then it returns 404.
- Edge: images stay under 300 KB.
- Error: image generation failure falls back to the default image.
- Empty: not applicable.

### M45-S04 Canonical and language readiness (Should)
As the owner, I want one canonical address per page, so that search engines do not split rankings.
- AC1: Given any public page with tracking or sort parameters, When read, Then the canonical is the clean absolute URL.
- AC2: Given search and paginated pages, When read, Then they are `noindex,follow`.
- AC3: Given more than one language is enabled, When a page is read, Then it lists hreflang alternates and `x-default`; with one language it lists none.
- Edge: `html lang` follows the active language.
- Error: not applicable.
- Empty: not applicable.

### M45-S05 Site description and social image in admin (Must)
As Sister Vanessa, I want to set the site description and the default share picture, so that links look right without a developer.
- AC1: Given `/admin/site-settings` Discovery tab, When I enter a description of up to 160 characters and choose an image, Then a live preview of a Google result and a WhatsApp card updates.
- AC2: Given I save, When any public page loads, Then its description fallback and default social image use the new values within 5 minutes.
- AC3: Given I enter more than 160 characters, When I type, Then a counter turns to a warning and save is blocked.
- Edge: share text template accepts `{title}` and `{siteName}` only.
- Error: save failure keeps the text.
- Empty: before values exist the tagline is used and the preview says "Using the tagline".

### M45-S06 Share menu (Must)
As a viewer, I want to share a title by WhatsApp or by copying the link, so that I can send it to friends and family.
- AC1: Given my phone supports native share, When I tap Share, Then the system share sheet opens with the title, text and link.
- AC2: Given a desktop browser, When I click Share, Then a menu offers Copy link and WhatsApp first, then Facebook and X, plus any channel the admin enabled.
- AC3: Given I copy, When it succeeds, Then I see "Link copied", and if the clipboard is blocked a selectable link field shows.
- AC4: Given I am on a kids profile, When the title page shows, Then there is no Share button.
- Edge: cancelling the native sheet shows nothing. All external links open in a new tab and say so to screen readers.
- Error: share failure falls back to the link field.
- Empty: not applicable.

### M45-S07 Typo tolerant search (Should)
As a viewer who mistypes, I want "did you mean" and still-found results, so that spelling does not stop me.
- AC1: Given I search "budgetng", When results load, Then I see budgeting titles and "Showing results for budgeting".
- AC2: Given a word of 4 characters or fewer, When searching, Then it matches exactly (no fuzzy noise).
- AC3: Given kids profile or guest kids mode, When a corrected query runs, Then only kid safe titles are returned.
- Edge: Pidgin and Yoruba words are never stemmed or corrected into English.
- Error: correction failure falls back to the plain search.
- Empty: see M06-S05.

### M45-S08 Synonyms and search by subject (Should)
As Sister Vanessa, I want searches for "money" to find finance lessons, so that viewers use their own words.
- AC1: Given a synonym group "money, finance, cash", When someone searches any of them, Then titles matching the others also appear, ranked below exact matches.
- AC2: Given I search a category name, When results show, Then a Subjects row with that category link appears above the titles.
- AC3: Given the Discovery tab, When I paste groups one per line and save, Then they apply without a deploy.
- Edge: at most 8 expansions per query. Groups need at least 2 terms.
- Error: invalid lines are listed with their line numbers and nothing is saved.
- Empty: the editor starts with a neutral seeded set and "Add your own words".

### M45-S09 Empty search help and misses report (Must)
As a viewer, I want suggestions when nothing matches, so that I never hit a dead end.
- AC1: Given no results, When the page renders, Then I see the query, tips, a did you mean link when one exists, subject chips and popular titles.
- AC2: Given I am a guest, When I search, Then the same state works without sign in.
- AC3: Given the owner opens the misses report (M19), When it loads, Then it lists top queries with no results with counts and an "Add synonym" shortcut.
- Edge: misses are stored without any account, profile, IP or session identifier and are deleted after 90 days.
- Error: miss logging failure never affects the response.
- Empty: the report says "No missed searches yet".

### M45-S10 Voice search (Could)
As a viewer on a phone, I want to speak my search, so that I type less.
- AC1: Given my browser supports speech recognition, When I tap the microphone, Then it listens, fills the box with what it hears and searches when I stop.
- AC2: Given first use, When I tap, Then a one line note says my browser may send audio to its speech service and I choose Continue or Cancel.
- AC3: Given no support, Data saver on, or a kids profile, When the box renders, Then no microphone shows.
- Edge: Escape or a second tap stops listening. Reduced motion replaces the pulse with a static ring.
- Error: permission denied shows "Microphone is blocked. You can still type."
- Empty: not applicable.

### M45-S11 Storage notice (Must)
As a viewer, I want to know what the site stores on my device, so that I can trust it.
- AC1: Given my first visit, When the page loads, Then a short notice appears at the bottom with the configured text, a Privacy link and a Got it button, and playback is never blocked.
- AC2: Given I tap Got it, When I return, Then it stays hidden until the admin bumps the notice version or 12 months pass.
- AC3: Given the Privacy page, When opened, Then it lists every cookie and storage key with purpose and duration, generated from the same list the code uses. The list includes the guest Kids mode choice and the import answer.
- AC4: Given a mobile phone with the bottom tab bar, When the notice shows, Then it sits above the bar and covers no controls permanently.
- Edge: with storage blocked the notice shows each visit and never errors. It adds no layout shift.
- Error: not applicable.
- Empty: with the notice disabled in settings nothing renders.

### M45-S12 Analytics posture (Must)
As the owner, I want to know analytics stays anonymous and first party, so that we meet the NDPA without a consent wall.
- AC1: Given any page, When network requests are listed, Then no third party tracker is contacted.
- AC2: Given Global Privacy Control is on, When I search or share, Then those events are not recorded.
- AC3: Given a developer tries to add a marketing or identified analytics script, When tests run, Then the consent guard test fails until a decision is logged.
- Edge: playback health telemetry stays because it is operational.
- Error: not applicable.
- Empty: not applicable.

### M45-S13 Performance budget (Should)
As a viewer on a slow phone, I want pages to load fast, so that I can watch without waiting.
- AC1: Given the Home, title and search pages on a throttled mobile profile, When measured, Then LCP is at most 2.5 s, CLS at most 0.1 and INP at most 200 ms.
- AC2: Given a build, When the budget script runs, Then it fails if a route exceeds 170 KB gzip first load JS, an image has no dimensions, the hero image is lazy, or more than four fonts are preloaded.
- Edge: budgets are config in `apps/web/src/lib/perf/budget.ts`.
- Error: not applicable.
- Empty: not applicable.

### M45-S14 Not found and error pages (Must)
As a viewer, I want helpful pages when something is missing or broken, so that I can recover.
- AC1: Given an unknown URL, When opened, Then the page keeps the header and offers one action, Back to Home, plus a search field and popular titles. Browse is the header link.
- AC2: Given a removed video, When its link opens, Then I see "This video is no longer available" with search and similar titles, with HTTP 404.
- AC3: Given a server error, When shown, Then I see plain words and one action, Try again, with the reference id and the support email shown as plain text. There is no Report link.
- AC4: Given the root layout fails, When shown, Then a minimal page with Try again appears.
- Edge: all error pages are `noindex`.
- Error: this is the error state.
- Empty: popular titles hide when none load.

Story counts: 14 stories in M45. Must 9 (S01, S02, S03, S05, S06, S09, S11, S12, S14), Should 4 (S04, S07, S08, S13), Could 1 (S10).

### Exact edits to existing stories
- M06-S03 Edge: replace "Edge: queries are trimmed, case and accent insensitive, up to 80 characters." with "Edge: queries are trimmed, case and accent insensitive, up to 80 characters. Signed out visitors can search (see M45-S09)."
- M06-S04: AC1 append "and a 'Showing results for budgeting' line (M45-S07)". AC2 append "Synonym groups from M45-S08 also apply."
- M06-S05 AC1: replace "a row of popular titles" with "a did you mean link when one exists, subject chips and a row of popular titles (M45-S09)". Edge: replace "(Could, M19)" with "(Must, M45-S09, stored without identifiers, 90 day retention)".
- M06-S10 Edge: replace "signed out search is not available (viewer is signed in)" with "signed out search is available and limited per IP and per guest session (L1)".
- M06-S07 Edge: keep "kids profiles store none" and add "Guests keep recent searches on the device only, under `ad-recent-searches`, listed in the storage inventory (M45-S11)".
- M26-S01 AC3: append "The privacy page includes the storage inventory table (M45-S11 AC3)."
- M26-S04 AC1: replace "keeps the header" with "keeps the header, offers Browse and popular titles (M45-S14)". AC2: append "and a Report link that prefills the reference".
- M26-S06: change heading priority "(Could)" to "(Must)", replace AC1 with "Given the site only uses essential cookies and local storage, When first visited, Then a short notice appears once with a link to Privacy and a Got it button and no tracking choices (see M45-S11 for the full rules)." Replace Edge with "Edge: shown to everyone by default, narrowed only where config says so."
- M34-S01 add "AC3: Given the storage notice, share menu and voice button, When I use only the keyboard, Then each is reachable, operable and dismissable with Escape, and focus returns to the trigger."
- M34-S02 add "AC4: Given the notice and the search results count, When they appear, Then they are announced politely (role region, aria-live polite) without moving focus."
- M34-S03 add "AC4: Given reduced motion, When the voice button listens, Then the pulse is replaced by a static ring."
- M07 title and series stories: add to M07-S01 "AC: the page carries VideoObject JSON-LD and a generated social image (M45-S02, M45-S03)". Use the existing M07-S01 numbering at build time.
- L1 stories already named in the audit (M01-S13, M01-S14, M08-S01) stay with L1. M45-S01 depends on them for public pages.

## 4. UI review (against the audit and the design skill)

Reviewed: `SearchBox.tsx`, `SearchScreen`, `TitleActions.tsx` share, `not-found.tsx`, `error.tsx`, plus the proposed notice and share menu. Findings are concrete and ranked.

Search
1. Must. The empty state exists in M06-S05 but code returns only `popular`; no tips, no subject chips, no did you mean. Fix in S7 (title "No results for 'xyz'" is one sentence, actions are chips plus the popular row, per audit rule "empty and error states with one sentence and one action").
2. Must. `SearchBox` keeps recent searches under `ad-recent-searches` for everyone, including kids profiles (M06-S07 says kids store none) and it is not in any inventory. Fix: read the active profile `isKids` and skip, and register the key in `STORAGE_INVENTORY`.
3. Should. Debounce of 250 ms and min 2 characters match the story. Loading shows only after 300 ms (verify; add a test `loading appears only after 300ms`). Results keep old content while loading (M06-S09 AC2), add the thin progress line if missing.
4. Should. Listbox options need 44 px height and the active option needs the focus ring token (3 px, 2 px offset), not only a background change (audit unchecked item: `.ad-tile:focus-visible` has `outline: none`; same trap here). Add a CSS test `search option active uses focus ring token`.
5. Should. Clear button inside the field: 44 px hit area with a 20 px glyph, `aria-label="Clear search"`, returns focus to the input.
6. Could. Voice button sits right of Clear, 44 px, toggle with `aria-pressed`, label "Search by voice".
7. Copy: no em or en dashes in tips; tips are "Check the spelling" and "Try fewer words" (existing wording OK).

Share
8. Must. Current share has no WhatsApp option on desktop and the manual URL field appears unlabeled beyond `aria-label`; add the menu (S6). Menu items are real links or buttons, 44 px, 8 px gap, tokens only, popover width at most 90 vw, opens as a bottom sheet on phones below 600 px, dialog semantics with focus trap and Escape.
9. Must. Toast "Link copied" uses a polite live region (check `toast` provider announces).
10. Should. Share icon plus visible text label on title page (icon only buttons are not allowed by the design rules unless labelled); ensure the label is not hidden on mobile.
11. Must. Hide for kids profiles (no external links).

Error pages
12. Must. `error.tsx` is a bare `pwa-offline` layout that does not use `ErrorState`, has no header, and gives the digest without a way to report. Fix in S12.
13. Must. `not-found.tsx` is good (header kept, Home, Search) but lacks Browse and popular titles; add them using card skeletons at ratio 16:9 while loading.
14. Should. 404 and error pages need one `h1`, focus moved to the heading on mount for screen readers, and `noindex`.

Notice
15. Must. Banner is `position: fixed`, bottom, max width 40rem on desktop and full width minus gutter on phones, solid `--color-surface` with border (not translucent over video), z layer from the token scale (below modal, above tab bar content), text 13 to 14 px token, button 44 px, link underlined with 4.5:1 contrast on the surface. No dark patterns: Got it is the only action, no countdown, no auto dismiss.
16. Must. It must not overlap the player controls (hidden on `/watch/*`, shown on return), nor the mobile bottom tab bar (offset by tab bar height plus safe area inset).
17. Should. Reduced motion: no slide in; fade only, 150 ms token, or none.

Cross cutting findings from the audit that touch this lane: hero preview and rotation settings (audit punch list 6) affect LCP, so S11 treats the first hero slide image as the LCP element and requires `priority`; the `.ad-tile` focus ring gap (audit section 4) applies to search result tiles and is fixed by the design lane, this plan adds a test for search tiles only.

## 5. Mockup list (S130 to S139)

Create as `/home/claude/ad/project/S130_*.dc.html` to `S139_*.dc.html`, tokens from `@ad/ui/tokens.css`, mobile 360 and desktop 1280 frames, each with default, loading, empty, error and focus states where they apply. Existing screens end at S66, so S130 to S139 are free.
- S130 Search, empty query: recent searches, popular subjects chips, voice button (idle) on mobile full screen and desktop page.
- S131 Search, typing: suggestions listbox with active option and focus ring, did you mean line, loading progress line.
- S132 Search results: grid with type badges, count, subjects row, Show more, partial failure retry.
- S133 Search, no results: tips, did you mean, subject chips, popular titles row, kids variant.
- S134 Voice search states: first use disclosure, listening (normal and reduced motion), permission denied, unsupported hidden.
- S135 Share menu: native sheet trigger, desktop popover, phone bottom sheet, copied toast, clipboard blocked field, kids profile without share.
- S136 Link previews: WhatsApp, Facebook and X card renderings from the generated 1200 by 630 image, default image variant, plus the Google result preview used in admin.
- S137 Admin Discovery tab: description with counter, social image picker with live previews, share text template, notice text and version bump, synonyms editor with error lines, misses report.
- S138 Storage notice: mobile above tab bar, desktop bottom, dismissed, disabled; plus the Privacy page storage inventory table.
- S139 Error pages: global 404 with search and popular titles, removed video 404, server error with reference and report, root error, offline variant.

## 6. Decisions to log in docs/DECISIONS.md (recommended option taken)

Use the next free D-number at merge time (highest on main today is D-168). Working ids below.
- D-L6-1 Search stays in Postgres (`simple` config, `pg_trgm`, `unaccent`, vocabulary table for correction) instead of adding Meilisearch or Typesense. Options: Postgres, external engine. Why: free tier hosting, one datastore, catalog under 10,000 titles. Reversible: yes, behind `searchTitles`.
- D-L6-2 The notice is an information banner, not a consent wall, because only strictly functional storage exists. Options: informational notice, full accept and reject banner. Why: NDPA transparency without friction, nothing to reject. Reversible: yes. Needs NDPA reviewer confirmation (see risks).
- D-L6-3 Analytics stays first party and anonymous, with no third party analytics at launch, and GPC and DNT respected for non operational events. Upgrade path is a real choice banner behind `canUse`. Reversible: yes.
- D-L6-4 Sitemap is paginated at 5,000 URLs per file, no `changefreq` or `priority`, `lastmod` from real change dates. Reversible.
- D-L6-5 Kids only titles are left out of the sitemap and carry `noindex`; general titles are indexable. Options: index all, index general only. Why: child safety and parental expectation; reversible.
- D-L6-6 Social images are generated from the poster (1200 by 630) under 300 KB with a configurable default, instead of requiring a hand made image per title. Reversible.
- D-L6-7 No `aggregateRating` or fabricated review markup, ever. Not reversible without policy risk.
- D-L6-8 WhatsApp is the first desktop share option; native share on phones. Channel tag `s` only for first party counts, stripped from canonical.
- D-L6-9 Voice search is Could, off for kids and Data saver, with a first use disclosure because the browser vendor processes audio.
- D-L6-10 `/search` and paginated listing pages are `noindex,follow`; categories, titles and series are indexable.

## 7. Risks and dependencies

- Lane L1 (guest access) gates public indexing: until `/title`, `/series`, `/browse` render real content to guests, crawlers see the sign in card or thin `PublicTitle`. Mitigation: fixtures behind the dev flag, integration in S12. The `ad_guest` cookie must be in `STORAGE_INVENTORY` and the privacy text; coordinate the inventory entry with L1 (they add one line to the constant).
- Migration number clash with other lanes (0036 and 0037): take the next free number at merge, keep additive.
- DECISIONS.md and USER-STORIES.md conflicts: append only, keep both.
- Cloudflare Workers free plan: dynamic OG images and sitemaps cost CPU; cache at the edge (`s-maxage`) and generate OG through the derivative pipeline where possible. Crawlers can raise play and request counts; robots disallows `/watch` and `/api`.
- WhatsApp preview quirks: needs absolute `https` image URLs, under about 300 KB, a reachable `og:image` without auth, and caches for days; changing a title image needs a new URL (append a `?v=<updated_at>` hash).
- Typo tolerance noise and cost: vocabulary correction on every keystroke is too heavy, so correction runs on submit and on suggestion fetch only for tokens with no exact hit, and results are cached 60 seconds per normalised query.
- Search miss logging is personal data adjacent: stored with no identifiers, 90 day retention, documented in the privacy inventory.
- Legal: the NDPA position (informational banner, anonymous analytics, guest cookie as functional) needs the NDPA review brief from the audit to confirm; GDPR and ePrivacy for diaspora visitors treat the guest cookie as functional only if it is not used for analytics or profiling (the daily hash must not link across days).
- Web Speech API sends audio to vendors and has uneven support (not on Firefox); it is a Could and feature detected.
- Performance: JSON-LD, OG routes and notice add little weight, but the share popover and notice must be dynamically imported to protect the 170 KB budget.
- Client inputs still needed (configurable, not blockers): site description, default social image, notice wording, final domain (canonical and sitemap), support email, synonym groups.

## 8. Owner questions

1. Should kids-only titles be excluded from search engines (recommended, D-L6-5) or indexed like other titles?
2. Is a short informational storage notice enough for the client's legal advisers, or do they want an Accept and Reject banner from day one (D-L6-2)?
3. Which social channels matter beyond WhatsApp, Facebook and X (for example Instagram, Telegram), so the share menu lists the right ones?
