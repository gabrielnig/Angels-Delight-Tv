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

## Slice 5 (rating rollup, Most liked)
- Queue `ratings.rollup` (concurrency 1, retry 3, delay 30 s, expire 5 min), `ENGAGE_CRON_SCHEDULES` (`*/15 * * * *` Africa/Lagos) in `packages/queue/src/definitions.ts`. Later engagement queues append to the same schedule list.
- `apps/worker/src/engage.ts`: `rollupRatings(db, rules)`, `pickMostLiked`, `wilsonLowerBound`, `DEFAULT_RATING_RULES` (10 raters, 85 percent, cap 10, top quarter). One transaction, idempotent. Registered by `apps/worker/src/engage-handlers.ts` from `main.ts`.
- Tests: `apps/worker/src/engage.test.ts`, `engage.int.test.ts`, `engage-handlers.test.ts`, `packages/queue/src/definitions.test.ts`.
- NOT done: `ratingTotals` analytics and the admin Top titles columns, CSV columns, settings keys for the rules (constants for now), Most liked row kind (slice 6).

## Slice 6 (trending, popular and Top 10, data and read path)
- Migration `0044_trending_rows.sql`: `row_kind` gains `trending`, `top_ten`, `most_liked`; table `title_scores`. `ROW_KINDS` extended.
- `packages/analytics/src/trending.ts`: `refreshTrending(db, now, config)` (7 Lagos days, decay 0.8, 3 plays per viewer per day, completions add one, series sum, min 10 plays, top 60) and 30 day popular. Queue `trending.refresh` (hourly at minute 10) in `ENGAGE_CRON_SCHEDULES`, handler in `apps/worker/src/engage-handlers.ts`.
- `packages/catalog/src/trending.ts`: `trendingTitles(tx, ctx, audience, { kind, limit })` (liveness, kids and maturity at read time, min 5 titles, min 50 site plays, 3 hour max age, Top 10 needs 10, popular needs 3 titles with 5 views), `mostLikedTitles`, `DEFAULT_TRENDING_RULES`. `resolveRow` handles `trending`, `top_ten`, `most_liked`.
- Tests: `packages/analytics/src/trending.int.test.ts`, `packages/catalog/src/trending.int.test.ts`, `apps/worker/src/engage-handlers.test.ts`, `packages/queue/src/definitions.test.ts`.
- NOT done: `popularTitles` still the old video only function (series in Popular, `fallbackTitle`), shared cache key by audience tier, `RankedRow` component and HomeView mapping, HomeCuration type picker, SystemView "Trending last refreshed", default launch seed rows, `trending.*` settings keys, refresh after the nightly rollup.

## Slice 11 (partial): DATA-MODEL My List cap now says 500 (matches `DEFAULT_RULES.maxMyListItems`).

## Slice 4c (merged by L5a): guest like replay
- `GuestIntent` has an optional `value` (-1, 1, 2) kept only for a like; a bad value is dropped on read. `TitleRating` remembers the tapped value and passes it to `SignInToSaveDialog`.
- `GuestIntentApplier` now takes both kinds. A like with a value is replayed through `PUT /api/ratings` for the active profile (toast "Rating saved" or the error text). A like with no value is dropped.
- Tests: `apps/web/src/lib/guest/intent.test.ts`, `components/guest/GuestIntentApplier.test.tsx`, `components/engage/TitleRating.test.tsx`.

## Slice 4d (merged by L5a): card rating chip, Most liked, focus peek
- `@ad/ui` `Cards.tsx`: `VideoCard` and `SeriesCard` take `rating` (`CardRating`: value, onChange, labels) and `mostLiked`. Actions cluster `.ad-card__actions` holds the chip (`CardRatingChip`, group named "Rate <title>", aria-pressed, chip first in DOM, `order` keeps the visual order) and My List. Exported `MostLikedLabel`. The link name says "Most liked" and "Your rating: Love this".
- CSS: chip only inside `hover: hover and pointer: fine`, expands on `:hover` and `:focus-within`, R37 ring on in-image controls, `:has(:focus-visible)` scales and shows the peek with no delay, `.ad-row__item:focus-within` lifts above neighbours. R10 hover rules were already in place.
- Web: `CatalogCard` saves through `PUT /api/ratings` with rollback and toast, only for a signed in non kids profile and an item that has `rating`. `ProfileKidsProvider` and `useProfileKids` added to `lib/profile-context`. `cardToItem` carries `rating` and `mostLiked`. Message keys `engage.rating.cardGroup`, `engage.rating.yours`, `engage.mostLiked`.
- Tests: `packages/ui/src/components/Cards.test.tsx`, `packages/ui/src/cards-css.test.ts`, `apps/web/src/components/CatalogCard.test.tsx`, `apps/web/src/server/data/mappers.test.ts`.
- Not done here: Most liked label on the title page, Most liked on the series card peek (series cards have no peek), maturity chip in the peek (slice 5, needs `maturityRank` on `TitleCard`), a cross card live update when one card of a title changes (M44-S02 AC2).

## Slice 7 (viewer notices, data, fanout, service; branch l5b-s07-notices)
- Migration `0048_viewer_notices.sql`: `viewer_notices`, `viewer_notification_prefs`, `videos.announced_at` with backfill, kids trigger, owner and worker policies, `notice_followers()` and `notice_video_audience()` for the worker. Worker role gets SELECT on `series`, `seasons`, `episodes`.
- `apps/worker/src/notices.ts`: `fanoutNotices(db, now, hooks)`, `pruneNotices(db, now)`. Queues `notices.fanout` (`*/10 * * * *`) and `notices.prune` (`40 3 * * *`), registered in `engage-handlers.ts`.
- `packages/viewer/src/notices.ts`: `listNotices`, `countUnread` (cap 99, kids 0), `markRead`, `getPrefs`, `setPrefs`. Kids get 403 `kids_no_notices`.
- Tests: `packages/db/src/notices.int.test.ts`, `apps/worker/src/notices.int.test.ts`, `packages/viewer/src/notices.int.test.ts`, `packages/queue/src/definitions.test.ts`, `apps/worker/src/engage-handlers.test.ts`.
- NOT done yet: API routes, bell, pages, settings, email prefs (slice 8).

## Slice 8a (bell, popover, /notifications, notices API; branch l5b-s08-bell)
- API: `GET`/`POST /api/notices` (`api.notices.list`, `api.notices.markRead`), `GET /api/notices/count` (`api.notices.count`, a kids profile gets `{count: 0}` and no table read, every other route 403 `kids_no_notices`), `GET`/`PUT /api/account/notifications` (`api.notificationPrefs.get`, `.set`). Schemas `noticesQuery`, `noticesReadBody`, `notificationPrefsBody`.
- UI in `apps/web/src/components/notices/`: `ViewerBell` (number badge capped 9+, spoken count, popover with focus trap and Escape, narrow screens link to `/notifications`, count refresh on route change and every 5 minutes while visible, none under Data saver), `NoticePanel`, `NoticeList`, `NoticesView`, `NoticesKidsState`, `useNoticeFeed`, `notice-format.ts`. Page `app/(viewer)/notifications`. `ViewerChrome` puts the bell in the nav `trailing` slot for non kids.
- Copy: `packages/shared/src/messages/l5-messages.ts` (spread into `EN_NG`). CSS block at the end of `packages/ui/src/components.css`.
- Tests: `apps/web/src/server/viewer/api-notices.int.test.ts`, `components/notices/*.test.ts(x)`, `components/ViewerChrome.test.tsx`.
- NOT done in 8a: settings page, email prefs and digest (8b). Episode notice body ("Episodes 6, 7 and 8 are ready") is empty for now.

## Slice 5 (merged by L5a): maturity UI wiring
- Guest ceiling: `PlaybackDeps.guestMaxRank` (number or function), wired to `maturity.guest_max_rank` in `server/video/runtime.ts`. `startGuestSession` and the guest branch of `key` refuse above it, Kids mode guests are 0. Tests in `packages/video/src/playback/service.test.ts`.
- Labels: `lib/maturity-context.tsx` (`MaturityLabelsProvider`, `useMaturityLabels`, `useMaturityLabel`), `server/maturity-labels.ts` reads `maturity.labels`. Provided by `AppShell` and the admin shell layout.
- Admin data: `VideoRecord.maturityRank`, `SeriesRecord.maturityRank`, `VideoPatch.maturityRank`, bulk action `{ type: 'maturity', value }` with undo, checklist key `maturity` ("Choose a maturity rating."), `SeriesPatch.maturityRank` and `applyToEpisodes` in the fixtures. `ConfirmDialog` takes `cancelLabel`.
- Admin UI: `VideoEditor` select, `PublishDialog` inline rating (`maturity` prop), `VideosList` Set maturity rating, `SeriesEditor` select with Apply to all episodes confirm.
- Viewer: `TitleCard.maturityRank` (catalog SQL), `CatalogItem.maturityRank`, peek chip `.ad-card__rated` (G draws none), spoken "Rated 15" in the link name, `MaturityBadge` and `MostLikedLabel` in the TitleView meta line. `ProfileForm` select (`ProfileInput.maxMaturityRank`, real and fixture update).
- Tests: `apps/web/src/lib/data/admin/{video-rules,video-bulk,video-queries,video-commands,collection-commands}.test.ts`, `components/admin/{VideoEditor,PublishDialog,VideosList,SeriesEditor}.test.tsx`, `components/profiles/ProfileForm.test.tsx`, `components/CatalogCard.test.tsx`, `components/title/TitleView.test.tsx`, `packages/catalog/src/titles.int.test.ts`, `packages/ui/src/components/Cards.test.tsx`.
- Not done: seed-demo ranks, the web route key matrix test, a maturity filter on the admin videos list, Most liked on the series card.
