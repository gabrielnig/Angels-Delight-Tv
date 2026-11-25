# Lane L15 build notes (share metadata, lane L15b; the Share sheet UI is lane L15a)

Audit: `docs/audits/2026-11-25-og-audit.md`. L15a owns share UI code. L15b owns metadata, share images, the admin share control and `pnpm share:check`. Do not edit each other's files; add your own section below.

## L15b slices

| # | Slice | State | PR |
|---|---|---|---|
| 1 | Metadata builder for every public route | in review | |
| 2 | Image pipeline and privacy gate | open | |
| 3 | Admin share control per video and series | open | |
| 4 | `pnpm share:check` and CI | open | |
| 5 | JSON-LD alignment | open | |
| 6 | Docs | open | |

## Slice 1

- `apps/web/src/lib/seo/metadata.ts`: `buildMetadata(site, page)`, `cleanText`, `trimWords`, `ogLocale`. `server/seo/site-meta.ts`: `getSiteMeta()`, `pageMetadata(page)` (what pages call). `lib/seo/share-image.ts`: `shareImageFor`, `shareImageVersion`. Test double `server/seo/site-meta-mock.ts`.
- Page kinds: `website`, `video` (og video.other), `series` (video.tv_show), `episode` (video.episode, unused until an episode page exists), `private` (noindex, no canonical, generic card).
- Removed `lib/seo.ts` (`previewMetadata`), replaced by the builder.
- Tests: `pnpm vitest run apps/web/src/lib/seo apps/web/src/lib/site/seo-settings.test.ts packages/theme/src/settings-discovery.test.ts apps/web/src/app/layout.test.tsx "apps/web/src/app/(viewer)"`.
