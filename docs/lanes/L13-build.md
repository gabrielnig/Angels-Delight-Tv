# Lane L13 build notes (module M51, series with configurable names)

Plan: `docs/plan/v2/L13-series.md`. Worktree `/home/claude/wt2/L13-build`. Decisions D-369 to D-371. Owner request: bundle videos into a series with his own words, such as Book and Chapter or Part and Lesson, instead of the fixed Season and Episode.

## Merged
- Slice 1 (label model): `packages/shared/src/series-labels.ts` (presets, `resolveSeriesLabels`, `effectiveSeriesLabels`, `validateSeriesLabels`, and the phrase helpers `groupName`, `itemName`, `itemCode`, `positionCode`, `positionLong`, `groupSummary`, `groupCount`, `itemCount`, `itemInSentence`, `groupInSentence`), catalog copy in `messages/l13-messages.ts`, subpath `@ad/shared/series-labels` for client bundles. Setting `content.series_labels` in `packages/theme/src/settings-registry.ts`. Migration `0059_series_label_overrides.sql` (`series.label_overrides jsonb`). `@ad/catalog` carries `labels` on `EpisodePosition` and on series `TitleCard`. Admin: Site settings, Series names tab (`SeriesNamesTab`, `SeriesNamesFields`), series editor Names section and worded headings, `updateAdminSeries({ labels })` with audit action `series.labels`. Viewer: `EpisodeList`, series page, `PublicSeries`, `SeriesCard` (props `itemsText` and `groupsText`), Continue Next code, title page line, primary button, activity and progress labels, marker siblings, upload and video editor fields. Scan test `scripts/series-copy-scan.test.ts` with an allowlist (schema names, fixtures, the CSV import vocabulary, the preset catalog).

## How to run scoped tests
- `pnpm vitest run packages/shared/src/series-labels.test.ts packages/theme/src/settings-series-labels.test.ts scripts/series-copy-scan.test.ts`
- `pnpm vitest run apps/web/src/components/admin/SeriesEditor.test.tsx apps/web/src/components/admin/site apps/web/src/components/title`
- Integration (needs `pg_ctlcluster 16 main start` and `TEST_DATABASE_ADMIN_URL`): `pnpm vitest run packages/catalog/src/videos.int.test.ts packages/catalog/src/titles.int.test.ts packages/catalog/src/admin/series-labels.int.test.ts`

## Known failures not caused by this lane (seen on origin/main when the lane started)
- `packages/catalog/src/admin/collections.int.test.ts` "publishes only when the checklist is met" fails on the maturity rating checklist item.
- `ErrorPage`, `error-pages.r39`, `consent/inventory`, `admin/tables` (AnalyticsView) and the analytics export route tests failed before the lane started.

## Left
- Slice 2: bulk Add to series, editor reorder and group moves. Slice 3: viewer series page polish. Slice 4: docs (stories, MODULES, SCREEN-ARCHITECTURE, DATA-MODEL, CLIENT-INPUTS).
