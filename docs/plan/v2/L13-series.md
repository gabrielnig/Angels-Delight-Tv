# L13 Series with configurable names (module M50) plan

Base: origin/main at 6835b9bc. Inputs read: docs/DATA-MODEL.md 5.5, `packages/db/src/schema/content.ts`, `packages/catalog/src/admin/series.ts`, `apps/web/src/components/admin/SeriesEditor.tsx`, the viewer series and title pages, `packages/theme/src/settings-registry.ts`, the message catalogs, docs/plan/v2/RULINGS.md.

## 1. Problem

The owner teaches the Bible and wants to bundle videos into a series with his own words: groups called Book or Part, items called Chapter or Lesson. Today Season, Episode and codes like E4 are written into admin copy, cards (Next: E4), notices, search results, mail, JSON-LD text and titles.

## 2. Model

- Four words (group singular and plural, item singular and plural) plus an item code prefix (E, Ch, L). The group code is the first letter of the group word.
- Site default: one setting `content.series_labels` (public, Admin tier). Per series override: nullable column `series.label_overrides` (jsonb, migration 0058, additive). Series override wins over the site default, which wins over the compiled default.
- Value shape: `{ preset: 'season_episode' | 'book_chapter' | 'part_lesson' | 'module_lesson' | 'custom', custom?: { group: {one, other}, item: {one, other} }, code?: string }`. Presets take their words from the message catalogs (translated per R23). Custom words are shown as typed in every language (D-351).
- Default is `season_episode` with code `E`, so nothing changes until the owner sets it.
- One helper in `@ad/shared` (`series-labels.ts`) builds every phrase. A scan test fails on any hardcoded Season or Episode copy outside an allowlist.

## 3. Stories (M50)

| Id | Story | Priority |
| --- | --- | --- |
| M50-S01 | Admin picks a preset or custom names for the whole site | Must |
| M50-S02 | Admin overrides the names for one series | Must |
| M50-S03 | Every viewer, admin, notice, mail and SEO text uses the chosen words | Must |
| M50-S04 | Admin adds many videos to a series from the Videos list with auto numbering, preview and undo | Must |
| M50-S05 | Admin reorders, moves between groups, renames groups, sees gap and duplicate warnings | Must |
| M50-S06 | Viewer series page has group tabs, item progress and a Play next or Resume button | Must |
| M50-S07 | Guests get device progress on the series page and the kids blocked screen where needed | Should |

## 4. Acceptance criteria (summary)

1. Each word is 1 to 24 characters, no markup, no dashes, no emoji. Code is 1 to 4 characters. Errors say what to fix.
2. Plural: presets use catalog plural forms; custom uses the singular form for a count of 1 and the plural form otherwise.
3. With nothing configured every screen reads exactly as before.
4. Scan test: `apps/web/src` and `packages/*/src` non test files contain no Season or Episode word in a string or JSX text outside the allowlist.
5. Bulk add: choose or create a series and group, order by pick order, title or upload date, preview, save, undo. One action per error (R39). Targets 44px. Admin tier only. Audit entries.
6. Series page: group select or tabs with the owner's word, item list with progress, one main button that follows device or account progress.

## 5. Slices (one PR each)

1. Label model, setting, column, helper, wiring, scan test, admin settings and editor override (M50-S01 to S03).
2. Bulk bundling and editor reordering (M50-S04, S05).
3. Viewer series page polish and guest progress (M50-S06, S07).
4. Docs: stories, modules, screens, data model, client inputs, changelog, lane note.

## 6. Decisions

D-351 label model and translation rule. D-352 settings registry plus a series column. D-353 bulk add and reorder rules. Numbers are renumbered on conflict.
