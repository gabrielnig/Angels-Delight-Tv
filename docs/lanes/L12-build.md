# Lane L12 build: the mobile header

Source: mockups `docs/mockups/v2/L12/S182` to `S185`, review `docs/reviews/v2/L12-review.md`, decisions D-356 and D-374.

## Slices

| Slice | State | Notes |
|---|---|---|
| 1 Header | built | `TopNav` gained `guest`, `kidsLabel`, `hasBell`, `guestActions`, `accountLabel`, `searchLabel`, `profileMenuLabel`. `GuestChrome` now renders `TopNav`. Header and tab bar skip /watch. |
| 2 Account sheet | built | `TopNav` `sheet` prop opens the shared `Modal` as `ad-sheet` under 600 px; `MenuItem` gained `variant` and `switch`; `Modal` gained `closeLabel`. Language stays in the bar, no swipe (D-378). |
| 3 Tab bar | built | `ad-tabbar` label clip, inside focus ring, pressed and hover, landscape bar. `validateTranslation` takes `key` and warns over 12 characters for the four tab keys (`TAB_LABEL_KEYS`, `TAB_LABEL_MAX` in `@ad/shared/messages`). Tabs stay Home, Browse, Search, My List as in S183. |
| 4 Scrim token and docs | built | `--nav-scrim-fade` replaces `--nav-scrim-hold`; `nav-scrim-contrast.test.ts` and the font layout test; DESIGN-SYSTEM 11.8 and 11.12, SCREEN-ARCHITECTURE (S81, S182 to S185), stories M47-S17 to S19 (D-381). |
| 5 Review and production build | done | Design system review of S182 to S185 code: 0 Blocker, 0 Major, 1 Minor. `pnpm --filter @ad/web build` passes and the build output carries the next/font size matched fallback. |

## Tests (scoped)

- `pnpm vitest run packages/ui/src/components/TopNav.test.tsx packages/ui/test/nav-css.test.ts packages/ui/test/topnav-width.test.ts`
- `pnpm vitest run apps/web/src/components/guest/GuestChrome.test.tsx apps/web/src/components/ViewerChrome.test.tsx`
- The width test needs Chromium (`/opt/pw-browsers` or `E2E_CHROMIUM_PATH`) and skips without it.

## Gaps

- Language row in the sheet and swipe to close are not built (D-378).
- Pre-existing failures outside this lane: `packages/ui/test/focus-ring.test.ts` (`.web-rail__link:focus-visible`) and `hover-guard.test.ts` (`tv.css:76`).

## Review findings (slice 5)

- Minor, left: `TopNav` still holds English strings that were there before this lane (Back, Skip to main content, Switch profile, Exit kids mode). They should take translated props like the new labels do.
- Checked and passing: no hardcoded colours, fonts, dashes or emojis in the changed files; every bar control 44 px (measured in Chromium); global focus ring plus the tab bar inside ring; hover only in the fine pointer query; reduced motion covers the sheet; Kids bar has a word badge.
- Not applicable: skeleton, forms, upload progress, captions.
