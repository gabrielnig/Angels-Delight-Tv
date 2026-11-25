# Lane L11 build notes (Browse page redesign, mockup S186, D-357 and D-358)

Worktree `/home/claude/wt2/L11-build`, branch per slice `l11/sN-...`. Review: `docs/reviews/v2/L11-review.md`. The hero part (S187) was built earlier.

Owner answers: length buckets change to Under 5 min, 5 to 15 min, Over 15 min (service, URL compatibility, tests, docs); the mobile scrim uses tokens.css values (R36 mismatch to be noted in a decision); the accent track contrast is accepted.

## Merged
- S1 category rail: `components/browse/CategoryRail.tsx` and `browse-rail.css` (one row, native scroll snap, edge fades, arrows on fine pointers only, selected chip centred on mount, 44px links), copy in `packages/shared/src/messages/l11-messages.ts`, wired into `BrowseView`. Tests: `CategoryRail.test.tsx`, `CategoryRail.layout.test.tsx` (real Chromium at 320, 360, 414 and 1360, skipped when no browser; helper `apps/web/src/test/layout-browser.ts`, set `PW_CHROMIUM` to pick a browser), `BrowseView.test.tsx`. Design skill review: pass, no findings.
- S2 menu bar: `BrowseControls.tsx` (sticky stack under the nav, router push into the URL, pending greys both buttons, Clear link, phone headroom through `browse-bar-state.ts`), `MenuButton.tsx` (desktop popover menu with menuitemradio and arrow keys, phone bottom sheet through the shared `Modal`, applied on tap, tinted when set), `browse-options.ts` (literal msg keys), `browse-controls.css`. The bar hangs under the rail (absolute) so hiding it never moves the rail; on phones it scrolls sideways because two buttons and Clear are wider than 320 to 414 (as drawn in S186), values are never cut. The old Length and Sort chip rows and the removable filter chips are gone from `BrowseView`. Tests: `MenuButton.test.tsx`, `BrowseControls.test.tsx`, `BrowseControls.layout.test.tsx` (real Chromium, 320, 360, 414, 1360, three value combinations), `browse-controls-css.test.ts`, `browse-bar-state.test.ts`, `browse-options.test.ts`, `BrowseView.test.tsx`.

## Not built yet (in order)
3. Grid polish, loading skeleton, two empty states, Show more states, kids variant.
4. Bucket change (service, URL compatibility, tests), DESIGN-SYSTEM 11.11 edit, stories, SCREEN-ARCHITECTURE, CHANGELOG, R36 decision.
