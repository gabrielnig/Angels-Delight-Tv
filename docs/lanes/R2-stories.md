# Lane r2: poster fade, search progress, blur placeholders, focus recut

Stories: M08-S27, M06-S09 (Must), M36-S02 (viewer side), M36-S03. Decisions D-156 and D-157.

## What exists
- `packages/ui/src/components/placeholder.ts`: `safePlaceholderColor`, `safePlaceholderBlur`, `useImageLoaded` (exported from `@ad/ui`).
- `Thumbnail` (cards) and `ResponsivePoster` draw `placeholderBlur`, else `placeholderColor`, and fade the image in on load. `toThumb` in `apps/web/src/server/data/mappers.ts` passes both from `ArtworkDto`. CSS: `.ad-card__blur` in `packages/ui/src/components.css`, `.ad-poster__blur` in `apps/web/src/components/media/media.css`.
- `apps/web/src/components/browse/SearchProgress.tsx` and `SearchScreen.tsx`: the live query runs in `useTransition`; the thin line shows while it is pending and the old grid stays.
- Focus recut: migration `0035_asset_poster_recut.sql` (`assets.cut_from`, `assets.cut_focus`); `setAdminPoster` takes an optional `recut` (`copySource`, `enqueue`) and creates the recut asset; `ImageService.process` crops with the stored focus and `adoptRecut` switches the video and removes stale recuts; `apps/web/src/lib/data/admin/real/videos.ts` passes the recut deps; `getAdminVideo.posterId` resolves a recut back to its source; `cropPreviewStyle` in `apps/web/src/lib/admin/poster-rules.ts` drives the picker previews.

## Scoped tests
- `pnpm vitest run packages/ui/src/components/Cards.test.tsx apps/web/src/components/media/ResponsivePoster.test.tsx apps/web/src/server/data/mappers.test.ts`
- `pnpm vitest run apps/web/src/components/browse/SearchProgress.test.tsx apps/web/src/components/browse/SearchScreen.test.tsx`
- `pnpm vitest run apps/web/src/lib/admin/poster-rules.test.ts apps/web/src/components/admin/PosterPicker.test.tsx`
- With `TEST_DATABASE_ADMIN_URL` set: `packages/video/src/image/service.int.test.ts`, `packages/catalog/src/admin/videos.int.test.ts`, `apps/web/src/lib/data/admin/real/catalog.int.test.ts -t recuts`.

## Gaps
- Hero art (`hero_asset_id`) is not recut; only posters.
- The preview assumes a 16:9 source. Uploads of another shape are centre cut to 16:9 for the picker thumbnail, so the preview for them is approximate.
- `catalog.int.test.ts` has two failures that exist on main (video list paging, custom poster key list); not touched.
- A recut that fails leaves the video on the uncut poster; there is no admin notice yet.
