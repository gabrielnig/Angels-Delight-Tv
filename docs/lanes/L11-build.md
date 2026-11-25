# Lane L11 build notes (Browse page redesign, mockup S186, D-357 and D-358)

Worktree `/home/claude/wt2/L11-build`, branch per slice `l11/sN-...`. Review: `docs/reviews/v2/L11-review.md`. The hero part (S187) was built earlier.

Owner answers: length buckets change to Under 5 min, 5 to 15 min, Over 15 min (service, URL compatibility, tests, docs); the mobile scrim uses tokens.css values (R36 mismatch to be noted in a decision); the accent track contrast is accepted.

## Merged
- S1 category rail: `components/browse/CategoryRail.tsx` and `browse-rail.css` (one row, native scroll snap, edge fades, arrows on fine pointers only, selected chip centred on mount, 44px links), copy in `packages/shared/src/messages/l11-messages.ts`, wired into `BrowseView`. Tests: `CategoryRail.test.tsx`, `CategoryRail.layout.test.tsx` (real Chromium at 320, 360, 414 and 1360, skipped when no browser; helper `apps/web/src/test/layout-browser.ts`, set `PW_CHROMIUM` to pick a browser), `BrowseView.test.tsx`. Design skill review: pass, no findings.

## Not built yet (in order)
2. Length and Sort menu buttons, popover and phone sheet, instant apply, Clear link, sticky rail and bar, phone headroom bar.
3. Grid polish, loading skeleton, two empty states, Show more states, kids variant.
4. Bucket change (service, URL compatibility, tests), DESIGN-SYSTEM 11.11 edit, stories, SCREEN-ARCHITECTURE, CHANGELOG, R36 decision.
