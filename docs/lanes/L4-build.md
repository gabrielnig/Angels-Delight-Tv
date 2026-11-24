# Lane L4 build notes (player features, M43)

Plan: `docs/plan/v2/L4-player.md` (section 11 wins), review: `docs/reviews/v2/L4-review.md`. Worktree `/home/claude/wt2/L4-build`. Scoped tests only.

## Merged slices
1. Player chrome (branch `l4/player-chrome`): rail and buffer tokens, new border, raised surface and switch off tokens, 44 px seek hit area with a 5 px to 8 px transform rail, hover rules inside the hover and fine pointer query, motion tokens, control scrim as `.adp::after` with the z-order tile 2, controls 3, toasts 4, two ring focus. Decisions D-190 to D-193. Tests: `packages/player/src/player.css.test.ts`, `packages/ui/src/player-tokens.test.ts`, edits in `PlayerView.chrome.test.tsx`.

## Resume points
Next: skip intro and credits (markers migration, service, controller, SkipButton, admin editor), chapters, theatre, standalone Up Next, autoplay default, caption appearance, settings menu, low data and errors, AirPlay behind a flag, audio (Could).
When `.adp-skip` is added, extend the z-order test in `player.css.test.ts` (skip above the scrim, below the controls).
