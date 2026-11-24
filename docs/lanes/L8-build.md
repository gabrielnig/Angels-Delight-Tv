# Lane L8 build: design system tuning and guards (M47)

Plan: `docs/plan/v2/L8-design-system.md` (section 13 Amendments win), rulings `docs/plan/v2/RULINGS.md`.
Scoped tests: `pnpm vitest run <file>`. CSS scanner helper: `packages/ui/test/css-scan.ts`.

## Merged
- S01 docs reconciliation (PR 217): DESIGN-SYSTEM, SCREEN-ARCHITECTURE, USER-STORIES (M05-S01 10 s, M47 block), MODULES (M47), BUILD-PLAN lanes table, audit Checked lines, duplicate id register (D-187 to D-189). Tests: `scripts/decisions-ids.test.ts`, `scripts/design-doc-sync.test.ts`.
- S02 guards and fixes: hover guard (stray hovers wrapped in player, watch, pwa, globals), focus ring guard (tile and card forced colours, tile outline offset), seek bar 44px. Tests: `packages/ui/test/hover-guard.test.ts`, `focus-ring.test.ts`, `touch-targets.test.ts`.
- S03 tokens: columns, gutter clamp, mobile first type, hero clamp, button, motion, scrim and fixed tokens, 1920 block, prose max (PR 249). Tests: packages/ui/src/design-tokens.test.ts
- S04 buttons: size tokens with a 44px before hit area, coarse pointer minimum, hover and press tokens (PR 251). Test: packages/ui/test/button-css.test.ts
- S05 reduced motion: Row paging uses auto scroll under reduce, reduced motion guard (PR 252). Tests: packages/ui/test/reduced-motion.test.ts, Row.test.tsx
- S06 rows: row is a named size container, columns 2.3 to 6.3 follow the container, arrows centred from the card width, paging by whole cards (PR 253). Tests: packages/ui/test/row-css.test.ts, Row.test.tsx
- S07 hover card: scale 1.25 after a 300 ms enter-only delay, origin first and last, peek with title, length, subject and Play, focus-within peek, row block padding, caption badge contrast fix, --hover-intent-delay removed, theme preview hero token synced (PR 254). Tests: packages/ui/test/hover-card-css.test.ts, Cards.test.tsx. Note: the plan row-gap compensation is not applied because --row-card-width lives on the viewport, so a row grows about 18px top and bottom on 600px and wider rows.
- S08 nav: IntersectionObserver sentinel at 40px replaces the scroll listener, solid and clear layers fade by opacity (linear, flip at 35 percent), scrim holds to 70 percent, 3px underline colour token, hero overlap kept in both states, solid fallback without IntersectionObserver (PR 255). Tests: packages/ui/test/nav-css.test.ts, TopNav.test.tsx
- S10 hero: HERO_ROTATE_MS 10000 shared with HomeHero, 350 ms opacity crossfade, stop after two loops, scrim stop tokens, translucent More info chip with white border, desktop text limit (PR pending). Tests: packages/ui/test/hero-css.test.ts, Hero.test.tsx, HomeHero.test.tsx. Not done: arrows beside Pause layout, text block measurement in Playwright.

## Remaining
S11 skeleton, S12 fonts, S13 copy, S14 tab bar, S15 wiring. Owner follow up: mirror packages/ui/src/tokens.css into .claude/skills/angels-delight-design-system/reference/tokens.css (shell may not write inside .claude/), then re-enable the skipped mirror check in packages/ui/src/theme.test.ts. Seek rail and buffer follow L4 on main (#6A6E78 and #9CA0AA), not the plan note values.
