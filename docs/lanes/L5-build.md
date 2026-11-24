# Lane L5 build notes (module M44, engagement)

Plan: `docs/plan/v2/L5-engagement.md`. Rulings: `docs/plan/v2/RULINGS.md`. Worktree `/home/claude/wt2/L5-build`, branches `l5-sNN-...`.
Scoped tests: `TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm vitest run <file>` after `pg_ctlcluster 16 main start`.

## Slice 1 (merged, PR 287): maturity foundation
- Migration `0038_maturity_ranks.sql`: `videos.maturity_rank`, `series.maturity_rank`, `profiles.max_maturity_rank`, backfill, triggers keeping `kids_safe` equal to rank 0 and forcing kids profiles to limit 0.
- `@ad/shared` `maturity.ts`: `maturityLabel`, `parseMaturityLabels`, `clampMaturityRank`. `Audience.maxRank` in `@ad/catalog`, applied in `liveVideoSql` and `liveSeriesSql`. `audienceOf` maps kids to 0.
- Tests: `packages/shared/src/maturity.test.ts`, `packages/db/src/maturity.int.test.ts`, `packages/catalog/src/visibility.int.test.ts`, `packages/viewer/src/profiles-audience.test.ts`.

## Slice 2 (service and enforcement part)
- Admin: `updateAdminVideo` takes `maturityRank` (legacy `suitability` maps to a rank), audit action `video.maturity` with from and to, bulk action `{ type: 'maturity', value }` all or nothing, `updateAdminSeries` takes `maturityRank` and `applyToEpisodes`, `AdminVideo.maturityRank`, `AdminSeries.maturityRank`.
- Publishing checklist item `maturity` ("Choose a maturity rating") for videos and series.
- `updateProfile` accepts `maxMaturityRank`: raising needs the account password (shares the `kids_exit` bucket), kids stay 0, leaving kids restores 2. `ProfileDto.maxMaturityRank`.
- Playback: `PlaybackService` session and key refuse titles above the profile limit (`withMaturityLimit`).
- Settings: `maturity.labels`, `maturity.guest_max_rank` (default 2). Guest audience carries `maxRank`.
- Tests: `packages/catalog/src/admin/videos.int.test.ts`, `series-maturity.int.test.ts`, `packages/catalog/src/publishing.int.test.ts`, `packages/viewer/src/profiles.int.test.ts`, `maturity-matrix.int.test.ts`, `packages/video/src/playback/service.test.ts`, `packages/theme/src/settings-registry.test.ts`.
- NOT done yet (UI wiring): VideoEditor and PublishDialog Maturity select, bulk menu, SeriesEditor control, ProfileForm select with password step, TitleView badge, card peek chip, seed-demo ranks, guest playback ceiling, the web route key matrix test.

## Slice 3 (ratings data and service)
- Migration `0042_title_ratings.sql`: `title_ratings` (owner RLS, `title_ratings_not_kids` trigger), `title_rating_stats`, `title_rating_aggregate()` for `ad_worker`, definer read policies for the migrator role on profiles and title_ratings. Schema in `packages/db/src/schema/engage.ts` (also added to `drizzle.config.ts`).
- `packages/viewer/src/ratings.ts`: `setRating`, `getRatings`, `ratingsFor`, `listMyRatings`, `RatingValue`. Bucket `engage`. `TitleCardDto` gains `rating` and `mostLiked`.
- Tests: `packages/db/src/ratings.int.test.ts`, `packages/viewer/src/ratings.int.test.ts`.

## Slice 4 (ratings API and control, partly done)
- `PUT` and `GET /api/ratings` (`api.ratings.set`, `api.ratings.get`, schemas `ratingBody`, `ratingQuery`). Test: `apps/web/src/server/viewer/api-ratings.int.test.ts`.
- Icons `thumbUp`, `thumbDown`, `heart`, `bell`, `sort`, `filter` (`packages/ui/src/components/Icon.test.tsx`). Message keys `engage.rating.*`.
- `apps/web/src/components/engage/RatingControl.tsx` (labelled group, aria-pressed, optimistic, Undo, rollback, guest ask, unavailable). Test: `RatingControl.test.tsx`. CSS block at the end of `packages/ui/src/components.css`.
- NOT done: mounting RatingControl in TitleView and TitleActions (needs profile id and rating from the title DTO), guest replay of the like intent (L1 `GuestIntentApplier` only replays my-list, the intent has no value), card hover actions cluster and rating chip, MostLikedLabel, `Cards.test.tsx` focus-within peek.
