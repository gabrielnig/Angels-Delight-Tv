# Lane L12 build: the mobile header

Source: mockups `docs/mockups/v2/L12/S182` to `S185`, review `docs/reviews/v2/L12-review.md`, decisions D-356 and D-374.

## Slices

| Slice | State | Notes |
|---|---|---|
| 1 Header | built | `TopNav` gained `guest`, `kidsLabel`, `hasBell`, `guestActions`, `accountLabel`, `searchLabel`, `profileMenuLabel`. `GuestChrome` now renders `TopNav`. Header and tab bar skip /watch. |
| 2 Account sheet | built | `TopNav` `sheet` prop opens the shared `Modal` as `ad-sheet` under 600 px; `MenuItem` gained `variant` and `switch`; `Modal` gained `closeLabel`. Language stays in the bar, no swipe (D-378). |
| 3 Tab bar | not started | |
| 4 Scrim token and docs | not started | |
| 5 Review and production build | not started | |

## Tests (scoped)

- `pnpm vitest run packages/ui/src/components/TopNav.test.tsx packages/ui/test/nav-css.test.ts packages/ui/test/topnav-width.test.ts`
- `pnpm vitest run apps/web/src/components/guest/GuestChrome.test.tsx apps/web/src/components/ViewerChrome.test.tsx`
- The width test needs Chromium (`/opt/pw-browsers` or `E2E_CHROMIUM_PATH`) and skips without it.

## Gaps

- Language row in the sheet and swipe to close are not built (D-378).
- Pre-existing failures outside this lane: `packages/ui/test/focus-ring.test.ts` (`.web-rail__link:focus-visible`) and `hover-guard.test.ts` (`tv.css:76`).
