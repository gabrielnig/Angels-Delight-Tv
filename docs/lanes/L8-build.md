# Lane L8 build: design system tuning and guards (M47)

Plan: `docs/plan/v2/L8-design-system.md` (section 13 Amendments win), rulings `docs/plan/v2/RULINGS.md`.
Scoped tests: `pnpm vitest run <file>`. CSS scanner helper: `packages/ui/test/css-scan.ts`.

## Merged
- S01 docs reconciliation (PR 217): DESIGN-SYSTEM, SCREEN-ARCHITECTURE, USER-STORIES (M05-S01 10 s, M47 block), MODULES (M47), BUILD-PLAN lanes table, audit Checked lines, duplicate id register (D-187 to D-189). Tests: `scripts/decisions-ids.test.ts`, `scripts/design-doc-sync.test.ts`.
- S02 guards and fixes: hover guard (stray hovers wrapped in player, watch, pwa, globals), focus ring guard (tile and card forced colours, tile outline offset), seek bar 44px. Tests: `packages/ui/test/hover-guard.test.ts`, `focus-ring.test.ts`, `touch-targets.test.ts`.
- S03 tokens: columns, gutter clamp, mobile first type, hero clamp, button, motion, scrim and fixed tokens, 1920 block, prose max (PR 249). Tests: packages/ui/src/design-tokens.test.ts

## Remaining
S04 buttons, S05 reduced motion, S06 rows, S07 hover card, S08 nav, S10 hero, S11 skeleton, S12 fonts, S13 copy, S14 tab bar, S15 wiring. Owner follow up: mirror packages/ui/src/tokens.css into .claude/skills/angels-delight-design-system/reference/tokens.css (the shell was not allowed to write inside .claude/). Seek rail and buffer follow L4 on main (#6A6E78 and #9CA0AA), not the plan note values.
Skipped test: packages/ui/src/theme.test.ts mirror check, re-enable after the owner copies the mirror.
