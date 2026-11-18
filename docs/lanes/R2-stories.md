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

## Part 2 (gaps closed, D-160 and D-161)
- Hero art: `setAdminPoster` also recuts `videos.hero_asset_id` from the hero's own source (purpose `hero`); `ImageService.adoptRecut` switches the right column by purpose.
- Real source shape: `processImage` returns `full` (a 480 wide webp of the whole picture) for non 16:9 sources; the service stores it in `assets.variants` with `full: true`; `artworkFromRow` drops it for viewers; `listPosterAssets` shows it and reports `previewRatio`; `cropPreviewStyle(focus, zoom, frameRatio, sourceRatio)` and the picker use it. A fresh client upload uses the local file's own shape.
- Failure: `ImageService.failRecut`, worker `onFailed` for `image.process`, `StaffNotifier.posterRecutFailed` (bell notice, kind `encode_failed`), `AdminVideo.posterRecut` (`processing` or `failed`) and a banner in `PosterPicker`.
- Two failing tests in `catalog.int.test.ts` fixed at the root: the list cursor became keyset based (an opaque string, not the offset `'1'`), and `PosterAssetDto` gained `score`; the tests were stale, the code was right.
- Extra scoped tests: `packages/video/src/image/process.test.ts`, `packages/catalog/src/artwork.test.ts`, `packages/catalog/src/admin/posters.int.test.ts`, `apps/worker/src/handlers.test.ts`, `apps/worker/src/notifier.int.test.ts`.

## Gaps
- Series hero art is not recut, because series have no saved focus.
- Pictures processed before part 2 have no full preview, so their crop preview for a non 16:9 source is still an approximation. Uploading the picture again fixes it.
- The poster page does not refresh by itself while a recut is being made; reload to see the state change.
