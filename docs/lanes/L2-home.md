# Lane L2: Home hero, rows and sections (M41)

Status: built. Plan: `docs/plan/v2/L2-home.md`. Rulings: R10 to R14, R30, R37, R39. Build log with PR numbers: `docs/lanes/L2-build.md`. Stories: M41-S01 to M41-S20. Decisions: D-274, D-275, D-282, D-288 to D-291, D-298, D-303, D-306, D-312, D-338 to D-344.

## What it owns

- Viewer: the hero carousel (`packages/ui/src/components/Hero.tsx`, `useHeroTimer.ts`, `HeroPreview.tsx`, `apps/web/src/components/home`), rows with View all, the list pages under `/browse` (`new`, `trending`, `series`, `row/[slug]`), the hover card (`HoverCard.tsx`), skeletons and states.
- Admin: Home curation (`apps/web/src/components/admin/HomeCuration.tsx`, `HomeSections.tsx`, `SectionEditor.tsx`, `ViewAllField.tsx`, `HeroSlots.tsx`), the video editor preview card (`PreviewClipCard.tsx`).
- Backend: `packages/catalog/src/rows.ts` (`heroCards`, `heroSlideExtras`), `packages/catalog/src/admin/home.ts` and `preview-clip.ts`, `packages/viewer/src/home.ts`, the worker clip job (`packages/video/src/preview.ts`, `apps/worker/src/preview-handlers.ts`), the apply tool home step (`packages/launch/src/apply.ts`).
- Data: migrations 0045, 0046 and 0050 (see DATA-MODEL).

## Rules to keep

- Two admin implementations (fixtures in `apps/web/src/lib/data/admin`, real in `packages/catalog/src/admin`) stay in step. `home-parity.test.ts` fails when they drift.
- The hero clip never loads unless `heroPreviewEligible` says so. The clip is decorative, muted and has no controls. Nothing in a row plays video.
- The hover card opens for a mouse only. Touch and keyboard focus keep the card actions.
- Every default label, interval and switch is a site setting, not a constant. Nothing here needs client input.

## Scoped tests

`pnpm vitest run packages/ui/src/components/Hero.test.tsx packages/ui/src/components/HeroPreview.test.tsx packages/ui/src/components/HoverCard.test.tsx apps/web/src/components/home apps/web/src/components/admin/HomeCuration.test.tsx apps/web/src/lib/data/admin/home-parity.test.ts`. Integration (need `TEST_DATABASE_ADMIN_URL`): `packages/catalog/src/rows.hero.int.test.ts`, `packages/catalog/src/admin/home.int.test.ts`, `packages/viewer/src/home.int.test.ts`, `packages/video/src/encode/preview.int.test.ts`.

## Known gaps

- Stories M41-S18 (upload your own clip) and M41-S19 (a viewer setting for previews) are Could items and are not built.
- `--row-pad-block` still reserves room for the old thumbnail scale and can be dropped in a tidy.
- Mockups S90 to S99 were not authored; the design system skill was used as the reviewer.
