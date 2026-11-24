# L2 design review: Home hero, rows and sections (S90 to S99)

Reviewer: design system skill, 24 November 2026. Inputs: `docs/plan/v2/RULINGS.md`, `docs/plan/v2/L2-home.md`, `docs/DESIGN-SYSTEM.md`, `docs/audits/2026-11-24-netflix-rea-audit.md`. Files reviewed and fixed in place: `docs/mockups/v2/L2/S90` to `S99` (desktop and `_m`), copied to `/home/claude/ad/project/`.

## Method and measurements

- Rendered every file with Playwright (Chromium) at 1360 for desktop files and at 360 and 390 for `_m` files.
- Touch targets: script measured every `a`, `button`, `role=switch`, `.btn`, `.pill`, `.circw` and tab element. Before: 20 desktop nav and logo targets under 44 on each viewer file, 29 admin switches at 28 high, admin sidebar at 40, notification button at 40. After: 0 under 44 in all 17 files (one non interactive page title in S97 mobile is 27 high and is not a control).
- Horizontal overflow: the `_m` files were fixed at 390 and overflowed 30 px at 360. After: 0 px at 360, 390 and 1360.
- Contrast (text): script walked every text node with computed colour and effective background; hero text over art was measured by pixel sampling with the art replaced by pure white (worst case bright art, R36), taking the lightest pixel under each text run.
- Dashes and emojis: none in any file (checked by code point, not by grep locale).
- The mockups use literal hex values by design (static design files). Token mapping stays a build job, notes below.

Worst case hero contrast, pure white art, after fixes:

| Screen | Before | After |
|---|---|---|
| Mobile top bar logo (360 and 390) | 2.05 (fail) | at least 5.7 |
| Mobile title zone, meta line with the R36 scrim at first draft (0.85 hold, 0.6 mid) | 4.18 (fail) | at least 5.7 (mid stop set to 0.7) |
| Desktop all hero text | at least 8.8 | at least 8.8 with the R36 foot gradient |
| White on primary blue (error panel) | 5.25 | 5.25 |

One apparent fail ("Play", 1.0 in S90 state 2) is the drawn white mouse cursor over the button, not a defect. Text inside the S90 state 4 crossfade frame is intentionally mid fade and exempt.

## Verdicts

| Screen | Verdict |
|---|---|
| S90 hero carousel, desktop and mobile | Changes required, then fixed |
| S91 hero preview clip, desktop and mobile | Changes required, then fixed |
| S92 hero loading, error, fallback, desktop and mobile | Changes required, then fixed |
| S93 hero conditions, desktop and mobile | Changes required, then fixed (scrim, mobile logo contrast, 360 fit), notes remain |
| S94 Home rows desktop | Changes required, then fixed |
| S95 Home rows mobile | Changes required, then fixed |
| S96 hover card | Changes required, then fixed |
| S97 admin Home sections, desktop and mobile | Changes required, then fixed |
| S98 admin hero slots and preview clip, desktop and mobile | Changes required, then fixed |
| S99 browse list pages, desktop and mobile | Changes required, then fixed (R39 error action, copy, nav targets), notes remain |

## Findings

Severity: Blocker (accessibility or CLAUDE.md rule), Major, Minor, Note. Status: Fixed means changed in the mockups and re measured.

| Id | Sev | Screens | Finding | Status and change |
|---|---|---|---|---|
| L2R-01 | Blocker | S90 to S93 mobile | Mobile top bar logo over bright art measured 2.05 to 1. | Fixed. Top scrim is now 0.75 to 40 px, 0 at 110 px. |
| L2R-02 | Blocker | S90 to S93 | Scrim did not follow R36 (desktop faded 0.85 to 0 over 45 percent, mobile held 0.9 to 64 and ended at 90). | Fixed. Desktop foot: 0.85 to 40 percent, 0.65 at 60, 0 at 100, plus the 0.88 text side scrim. Mobile: 0.85 to 50, 0.7 at 65, 0 at 80. Alpha stays above 0.57 across the title zone. Spec captions rewritten with the measured numbers. |
| L2R-03 | Major | S98 | Admin hero preview used a left to right 0.88 to 0.3 scrim, white text on bright art about 3.9 to 1. | Fixed. Same R36 foot gradient as the viewer hero. |
| L2R-04 | Major | S92 d and m | Hero error panel offered two actions (R39). | Fixed. One action, Try again. Caption says rows below still load. |
| L2R-05 | Major | S92 | Nav links at white 0.85 on the primary blue error panel measured 4.27. | Fixed. Nav links are solid white in S92. |
| L2R-06 | Major | S99 | Error state had Retry plus a link out (R39). Copy differed from the plan. | Fixed. One action. Error heading "Could not load this list", empty "Nothing here yet" with "Nothing is trending yet. See what is new." |
| L2R-07 | Major | all viewer desktop files | Nav links 42 px high and 43 px wide, logo link 28 px (R30). | Fixed. `min-height` and `min-width` 44, logo link 44 high. Mobile logo link 44 high. |
| L2R-08 | Major | S97, S98 | Admin sidebar links 40 px, notification button 40 px, profile link 32 px, search field 40 px, 29 switches 28 px high (R30). | Fixed. All 44. Switch track stays 28 px, hit area is 48 by 44 (`.sw2` is a 44 px box with the track drawn by `:before`). |
| L2R-09 | Major | S90 to S99 mobile | Frames were fixed at 390 px and overflowed 30 px at 360. | Fixed. Frames use `width:100%; max-width:390px`. Measured 0 overflow at 360. |
| L2R-10 | Major | S94, S95, S97 | Continue learning showed View all, against M41-S08 edge (no View all) and the S97 row summary. | Fixed. Removed from S94, S95 and the S97 live preview. S94 state 2 caption points to states 3 and 4 for the hover reveal. |
| L2R-11 | Major | S95 state 4 | Kids Home used 2.1 cards at 170 px. R11 says kids phone rows use 2.3. | Fixed. 156 px cards, 2.3 visible, caption states R11. |
| L2R-12 | Major | S96 state 3 | Keyboard focus opened the hover card. M41-S14 AC3 says focus never opens it, and a scaled card on focus overlaps neighbours. | Fixed. State 3 now shows the tile with the R37 ring (3 px, 2 px offset) and the My List corner button. Spec says Enter opens the title page. |
| L2R-13 | Major | S97 | M41-S06 edge says two sections may share a name. Mockup refused a duplicate as an error. | Fixed. Duplicate name is only a note ("This link will end in -2"). |
| L2R-14 | Major | S97 d and m | No delete confirmation and no built in rule (M41-S06 AC3). | Fixed. Added state 11 (Delete confirmation naming what goes and what stays) and state 12 (built in section, Remove disabled with a reason). |
| L2R-15 | Minor | S97 | Copy: "Give this section a name." (AC says "Give the section a name"), link error did not match AC2 ("Use a path on this site or an https link"), "fewer than 1 titles", View all target shown only as a path (AC1 wants words). | Fixed. AC wording, "Hidden while it has no titles", "Opens All new videos (/browse/new)". |
| L2R-16 | Minor | S97 | Reorder announcement named no text. | Fixed. Spec gives the live region text "Moved New this week to position 2". |
| L2R-17 | Minor | S90 to S93 | Pause control names were "Pause slideshow" and "Resume". AC3 says "Resume rotation". | Fixed. Visible text "Pause" and "Resume rotation"; icon only mobile buttons have `aria-label` "Pause rotation" and "Resume rotation" (label in name satisfied). |
| L2R-18 | Minor | S98 | Muted text 4.44 on the selected tint. Read only (no permission) card looked almost enabled. | Fixed. `.mutd` is #4A4F5A. Read only radios are `aria-disabled`, 0.7 opacity, `not-allowed`. |
| L2R-19 | Minor | S97 | Live preview mini hero text 3.3 to 4 on its gradient end. | Fixed. Gradient ends at #2A7BC0. |
| L2R-20 | Note | S96, S94 | Tile focus ring is clipped by the row's `overflow: hidden`. | Build note 6. |
| L2R-21 | Note | S93 | Variants are drawn at 622 px wide, not at the real breakpoints. Logic is right, geometry is illustrative. | Accepted. |
| L2R-22 | Note | S99 | List grid drawn at 6 across at 1360. The plan says 5 at 1280, 6 from 1920. Spec text already says so. | Accepted, build follows the plan. |
| L2R-23 | Note | DESIGN-SYSTEM | 11.7 still says "No autoplay video" and manual by default, and a yellow or solid secondary. R12 and R13 supersede. | Doc edit for the build lane, see build notes. |

## Rulings applied to this lane

- R10 hover card: S96 shows 1.25 scale, 300 ms, origin left for the first card and right for the last, hover capable devices only, nothing on touch. Verified in captions. S96 state 3 corrected so focus follows it (no card).
- R11: S94 5.3, S95 2.3, kids 2.3 (fixed). S99 list grid follows the plan.
- R12: auto rotate 10 s, Pause beside the arrows, More info translucent with white border (not yellow). Verified S90, S93.
- R13: S93 variant D shows "slow or unknown connection (Safari, Firefox)" with no clip. Verified.
- R14: "Continue learning" is the top row title everywhere.
- R30, R31, R39: fixed above. R36: fixed above. R37: shown in S96 state 3 and S94 state 4. R35: clear nav underline in S90 to S93 uses the dark accent ring colour (#FFC93C), solid navs keep blue.
- R38: caption badge fill is white at 0.78 with navy text (at least 9 to 1 on black art, high on white art). Not changed.

## Story and finding coverage (visible in the design)

Visible: M41-S01 AC1 to AC3 (S90, S92), S02 AC1, AC2, AC3, AC4, AC5, AC6 (S90, S93), S03 AC1 to AC4 (S92 state 3, S98 state 2), S05 (S94), S06 AC1 to AC4 (S97 states 3, 4, 5, 9, 11, 12), S07 AC1 and AC2 (S97), S08 AC1 to AC4 (S94, S97), S09 (S99), S10 AC1 to AC3 (S94, S95), S11 AC1 to AC4 (S91, S93), S13 (S98), S14 AC1 to AC4 (S96). Plan findings F07, F08, F09, F10, F12, F13, F16, F17, F18, F19, F21 to F25 are drawn. F01 to F06, F11, F14, F15, F20, F26 to F28 are build or data items.

## Remaining for the build (exact notes)

1. Tokens. Replace the mockup literals with tokens: hero foot scrim `linear-gradient(to top, rgb(var(--scrim-rgb) / .85) 0, rgb(... / .85) 40%, rgb(... / .65) 60%, transparent 100%)` on min-width 960 and `0, .85 50%, .7 65%, transparent 80%` below. Top bar scrim on mobile `.75` to 40 px then transparent at 110 px. Add a contrast test with three pure white and near white images at 360, 390 and 1360 (white text at least 4.5 on each text run, and alpha above 0.57 in the title zone, R36). Keep `--color-ink-muted` off tinted surfaces or use the darker `#4A4F5A` value there (4.44 failed on the selection tint).
2. Dots, arrows and Pause are `button` elements (the mockups use spans). Dots are 44 by 44 with `aria-current`, the progress fill is `transform: scaleX()` only. Pause is a text button with `aria-label` containing its visible text ("Resume rotation"). Region `aria-live` is `off` while rotating and `polite` when paused or focused.
3. Nav links and logo: `min-height: 44px; min-width: 44px` (shared component, R32).
4. Row card widths come from `--cards-visible` (2.3, 3.3, 4.3, 5.3, 6.3) not from the 156 and 236 px in the mockups. At 360 the 156 px cards show 2.2, so use the fraction.
5. Switches: 48 by 44 hit area with a 28 px track (see `.sw2` in S97).
6. Row scroller: add 4 px vertical padding and `scroll-padding` inside `overflow: hidden` so the 3 px offset focus ring (R37) is not clipped, plus `outline: 2px solid transparent` for forced colours.
7. Hover card (R10, R31): inside `@media (hover: hover) and (pointer: fine)`, 300 ms intent delay, no card on focus. Focus reveals View all and the corner My List button only.
8. Reduced motion: use `prefers-reduced-motion: reduce` for crossfade, shimmer, arrows fade, hover card scale. The mockups are static so none of this is drawn.
9. Docs: DESIGN-SYSTEM 11.7 and sections 8 and 13, M05-S01, M25-S03 need the R12 and R13 wording (rotation on by default, optional muted clip, More info translucent with white border).

## Story AC the design cannot show

- M41-S01 AC3 (artwork load failure falls back to the solid theme colour) and Edge: needs a component test, S92 shows only the API failure panel.
- M41-S02 AC1 timer restart on manual change, AC2 hold on hover, focus and hidden tab, AC4 live change of the OS setting, AC5 stop after two loops, swipe threshold 50 px: behaviour tests.
- M41-S04 launch defaults, apply tool, dry run, Restore launch defaults audit entry: tool and service tests.
- M41-S05 AC2 Trending hidden under 4 titles without copying New, AC3 category rules: server tests.
- M41-S06 AC4 12 section limit, name trimming and slug uniqueness; M41-S08 AC2 refused values (`//x.com`, `http://`, `javascript:`) and AC5 external mark with `rel="noopener noreferrer"`: validation tests. S97 draws one invalid link only.
- M41-S09 AC5 not found for kids on non kid visible rows, reserved category slugs: route tests.
- M41-S10 AC2 scroll snap, AC4 arrow keys moving focus: browser tests.
- M41-S11 and S12: eligibility checks, 2 s stall removal, connection drop, worker encoding and size limits are not drawable.
- M41-S13 AC2 start beyond duration minus 6 seconds refusal: S98 shows the frame picker but no error line, add it in the build with the copy "Start at least 6 seconds before the end."
- M41-S14 AC1 passing under 300 ms opens nothing, AC4 Escape and pointer leave: behaviour tests.

## Blocking the build

Nothing blocks the build. Slices 3, 4, 7, 10, 11 and 12 are cleared against the fixed mockups. Build lanes must use the fixed files, not earlier copies.
