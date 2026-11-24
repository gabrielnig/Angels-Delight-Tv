# Lane L6 build notes (module M45, discovery, SEO, consent and search)

Plan: `docs/plan/v2/L6-discovery.md`. Rulings: `docs/plan/v2/RULINGS.md`. Review: `docs/reviews/v2/L6-review.md`. Worktree: `/home/claude/wt2/L6-build`. Branch per slice `l6/sN-...`.

## Slices

| # | Slice | State | PR |
|---|---|---|---|
| 1 | Sitemap and robots line | merged | #283 |
| 2 | Structured data (JSON-LD), kids only noindex | merged | #292 |
| 3 | Share images and metadata | in review | |

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
