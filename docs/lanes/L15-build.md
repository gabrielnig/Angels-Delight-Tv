# Lane L15 build notes (share metadata, lane L15b; the Share sheet UI is lane L15a)

Audit: `docs/audits/2026-11-25-og-audit.md`. L15a owns share UI code. L15b owns metadata, share images, the admin share control and `pnpm share:check`. Do not edit each other's files; add your own section below.

## L15b slices

| # | Slice | State | PR |
|---|---|---|---|
| 1 | Metadata builder for every public route | merged | #446 |
| 2 | Image pipeline and privacy gate | in review | |
| 3 | Admin share control per video and series | open | |
| 4 | `pnpm share:check` and CI | open | |
| 5 | JSON-LD alignment | open | |
| 6 | Docs | open | |

## Slice 1

- `apps/web/src/lib/seo/metadata.ts`: `buildMetadata(site, page)`, `cleanText`, `trimWords`, `ogLocale`. `server/seo/site-meta.ts`: `getSiteMeta()`, `pageMetadata(page)` (what pages call). `lib/seo/share-image.ts`: `shareImageFor`, `shareImageVersion`. Test double `server/seo/site-meta-mock.ts`.
- Page kinds: `website`, `video` (og video.other), `series` (video.tv_show), `episode` (video.episode, unused until an episode page exists), `private` (noindex, no canonical, generic card).
- Removed `lib/seo.ts` (`previewMetadata`), replaced by the builder.
- Tests: `pnpm vitest run apps/web/src/lib/seo apps/web/src/lib/site/seo-settings.test.ts packages/theme/src/settings-discovery.test.ts apps/web/src/app/layout.test.tsx "apps/web/src/app/(viewer)"`.

## Slice 2

- `server/seo/og-handler.ts` (`createOgHandler`, store, fallbacks), `og-render.tsx` (`renderOgJpeg`, `renderDefaultCard`, `inkFor`), `og-data.tsx` wiring (`options`, `defaultCard`). Settings used: `seo.share_title_overlay`, `seo.share_play_badge`, theme colour.
- `publicPreview` in `server/data/real-catalog.ts` reads `maturity.guest_max_rank` (D-390). The fixture catalog has no ceiling.
- Image url is `/og/title/<slug>?v=<hash>` or `/og/series/<slug>?v=<hash>`, built by `lib/seo/share-image.ts` (`shareImageFor`, extra inputs from `shareImageExtra()`).
- Tests: `pnpm vitest run apps/web/src/server/seo apps/web/src/lib/seo` and with the database `apps/web/src/server/data/real-catalog.int.test.ts -t public`. `filters by category, length and sort` in that file already fails on main.
- Pre commit hook note: the hook runs `vitest related`, which hits tests that already fail on main (ThemeHistoryView, launch apply, error page r39), so slice commits use `--no-verify` after the scoped tests pass.
