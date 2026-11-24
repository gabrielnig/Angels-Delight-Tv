# Lane L6 build notes (module M45, discovery, SEO, consent and search)

Plan: `docs/plan/v2/L6-discovery.md`. Rulings: `docs/plan/v2/RULINGS.md`. Review: `docs/reviews/v2/L6-review.md`. Worktree: `/home/claude/wt2/L6-build`. Branch per slice `l6/sN-...`.

## Slices

| # | Slice | State | PR |
|---|---|---|---|
| 1 | Sitemap and robots line | in review | |

## Slice 1 (sitemap)

- `packages/catalog/src/sitemap.ts`: `listSitemapRows(db, now)` returns `{ videos, series, categories }` of `{ slug, lastmod }`. Live, ready, published (or scheduled and due), not trashed, standalone videos that are not kids only (D-269).
- `apps/web/src/lib/seo/sitemap.ts`: `buildSitemapEntries(origin, rows)`, `chunkEntries`, `SITEMAP_CHUNK_SIZE` 5000, `MAX_URL_LENGTH` 2048. `sitemap-xml.ts` renders the XML.
- `apps/web/src/server/seo/sitemap-handlers.ts`: `createSitemapHandlers({ load, origin })` with `index` and `chunk`. Wired in `sitemap-data.ts`, routes `app/sitemap.xml/route.ts` and `app/sitemaps/[id]/route.ts` (D-268).
- `robots.ts` names `${APP_ORIGIN}/sitemap.xml` whenever the origin is set.
- Scoped tests: `pnpm vitest run apps/web/src/lib/seo apps/web/src/server/seo apps/web/src/app/robots.test.ts packages/catalog/src/sitemap.int.test.ts` (the last needs `TEST_DATABASE_ADMIN_URL`).
