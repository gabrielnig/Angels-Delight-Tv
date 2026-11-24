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
