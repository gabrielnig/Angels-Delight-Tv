# Lane L2 build notes (module M41, Home hero, rows and sections)

Plan `docs/plan/v2/L2-home.md`, review `docs/reviews/v2/L2-review.md`, rulings `docs/plan/v2/RULINGS.md`. Worktree `/home/claude/wt2/L2-build`, branch per slice `l2/sN-...`.

## Slices

| # | Slice | State | PR |
|---|---|---|---|
| 1 | Hero artwork and five newest fallback | merged (restored by 288 after two other lanes reverted it) | 281, 288 |
| 2 | Home settings, Home tab, rules | merged | 289 |
| 3 | Hero carousel rewrite, scrim measured | merged | 299 |
| 4 | Row View all, snap, gap compensation, skeleton height | this PR | |

## Exists

- Hero: `packages/ui/src/components/useHeroTimer.ts` (clock), `Hero.tsx` (`intervalMs`, `maxLoops`), `apps/web/src/components/home/hero-items.ts`, `HomeHero.tsx` takes `rotate`, `intervalSeconds`, `maxLoops` from settings read in `HomeView`.
- `packages/catalog/src/rows.ts` `heroCards(..., fallbackCount)`; `ViewerRules` home fields.
- Settings group `home` (Home tab in Site settings).
- Chromium text zone test: `packages/ui/test/hero-text-zone.test.ts` (skips without Chromium, `HERO_DEBUG=1` prints geometry).
- Row: `viewAllHref`, `viewAllLabel`, `viewAllExternal` (`seeAllHref` is a deprecated alias).

## Scoped tests

`pnpm vitest run packages/ui` (package only), `packages/catalog/src/rows.hero.int.test.ts`, `packages/viewer/src/home.int.test.ts` (need `TEST_DATABASE_ADMIN_URL`).

## Heads up

- Commits 71b5d54 and 5df08b4 (other lanes) silently reverted slice 1 files. Check `git diff origin/main` of your own files before relying on them.
- The mobile hero scrim differs from R36 stops on purpose (D in DECISIONS, measured).
