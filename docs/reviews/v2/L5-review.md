# L5 Engagement UI review (S120 to S129)

Reviewer: design system skill (`angels-delight-design-system`). Inputs: `docs/plan/v2/RULINGS.md` (rulings win), `docs/plan/v2/L5-engagement.md`, `docs/DESIGN-SYSTEM.md`, the audit, mockups S120 to S129 (18 files in `docs/mockups/v2/L5/`, mirrored to `/home/claude/ad/project/`). Date: 24 November 2026.

## Method

All numbers below were measured with scripts, not judged by eye.

- Touch targets: every `a`, `button`, `input`, `select`, `summary`, `[role]` control, switch, checkbox, chip, pill and tab measured with `getBoundingClientRect` at 1360 (desktop boards) and 390 (mobile boards), plus a second pass on anything with `cursor: pointer`. Threshold 43.5 px on both axes (R30).
- Contrast, flat surfaces: computed from each text node's colour composited over its ancestors' background colours, 4.5:1 for text, 3:1 for large text.
- Contrast, text on imagery (card peek, duration chips, Most liked label): the board was re-rendered with all text transparent, each text box was cropped from the screenshot and the 8th percentile worst pixel was compared with the text colour.
- Dark ink on lemon at size 1.15: every board was re-run with page and band surfaces replaced by `#FFF6B8` and every font size multiplied by 1.15. Contrast was recomputed and overflow, clipping and no-wrap overflow were checked. Pair ratios on lemon: ink 15.5, muted `#5B606B` 5.7, link blue `#1F6FB5` 4.8, error `#B42318` 6.0, border strong `#8A8D94` 3.0, accent yellow `#FFC93C` 1.4 (never text, never the only edge).
- Mobile: boards are drawn at 390. Each `_m` board was also re-rendered with its 390 frames narrowed to 360. No horizontal page overflow at 360 (the only clipped boxes are intentional scrolling rows, pill strips and the settings tab strip). S121 is a combined board drawn at 1360 although its name ends in `_m`.
- Copy: grep for en dashes, em dashes and emoji over all 18 files and the plan: none.
- Story coverage: every M44 AC was searched for in the board text and aria labels, then confirmed on the rendered boards.

## Verdict per screen

| Screen | Before | After fixes | Notes |
|---|---|---|---|
| S120 Title page rating (desktop, mobile) | Changes required | Approve with minor fixes | Breadcrumb and category links were 17 px tall (R30, R32). Nav and logo links under 44. All rating states, toasts, guest, unavailable and kids frames present. |
| S121 Guest rating dialog and return toast | Approve with minor fixes | Approve | Only the shared nav and logo targets needed raising. Dialog, sheet, return toast, replay failure and kids drop all drawn. |
| S122 Card hover actions | Changes required | Approve with minor fixes | Contrast blocker on the peek and Most liked label, hover was lift only (R10), yellow focus ring on imagery. All fixed. |
| S123 Home trending (desktop, mobile) | Approve with minor fixes | Approve with minor fixes | Rows showed exactly 5 cards, R11 wants 5.3. Fixed on desktop. Mobile already shows 2.3. |
| S124 Notification bell, notifications page | Approve with minor fixes | Approve with minor fixes | Nav and logo targets raised. No reduced motion note for the popover (build item). |
| S125 Notification settings | Approve with minor fixes | Approve with minor fixes | Switches already 44 px rows. Nav and logo raised. |
| S126 Profile maturity | Approve with minor fixes | Approve | Option copy fixed, forced colours ring offset set to 2 px (R37). |
| S127 Admin maturity and ratings | Changes required | Approve with minor fixes | Sidebar 40, bell 40 and account link 32 raised to 44 (R30). Home curation picker (M44-S10) was missing and is now drawn. Bulk bar gained the Select all link. |
| S128 My List filters | Approve with minor fixes | Approve | Pills already 44. Nav and logo raised. |
| S129 Continue watching | Approve with minor fixes | Approve | Row title now "Continue learning" (R14), kebab focus ring readable on thumbnails. |

## Findings

Severity follows the skill: Blocker breaks accessibility or CLAUDE.md, Major is a missing state or target under 44 or wrong spec, Minor is polish, Note is for the build.

| ID | Screen | Severity | Finding | Status |
|---|---|---|---|---|
| F1 | S122 | Blocker | White text on the card peek failed on light thumbnails. Measured 2.83 (G description on green), 3.45 (description on yellow), 2.85 (Most liked label). Need 4.5. | Fixed. Peek scrim now holds 0.88 alpha near black to 62 percent, with 36 px of top padding. Worst measured text now 9.58. |
| F2 | S122, plan | Blocker | Hover was a 4 px lift with a 500 ms delay, against R10 (scale 1.25, 300 ms, origins). | Fixed. The whole card (thumbnail and text) scales 1.25 with transform only. Origin centre, left for the first card, right for the last. Reduced motion frame has no scale. Plan line 469 (400 ms) and finding 7 rewritten to R10. |
| F3 | S120 to S129 | Major | Viewer nav links 42 px high and as narrow as 42 px wide, logo link 28 px high (R30). 129 instances over 18 boards. | Fixed. `min-height` and `min-width` 44 on every nav link and the logo link. |
| F4 | S120 | Major | Breadcrumb links 17 px high (R30, R32). | Fixed. Links `min-width: 44px`, 44 px high, current crumb `display: inline-block; line-height: 44px`, wrapped in `nav aria-label="Breadcrumb"`. |
| F5 | S120 | Major | Category link above the title 17 px high (11 instances). | Fixed to 44. |
| F6 | S127 | Major | Admin sidebar links 40 px, bell 40 px, account link 32 px (R30). | Fixed to 44. |
| F7 | S127 | Major | Row select checkbox visual is 22 px. | Fixed in the mock with a 44 px invisible hit area. Build: the whole 44 px cell is the label. |
| F8 | S127 | Major | M44-S10 AC1 to AC3 and plan finding 25 (three new row types with help, Fall back to newest, fallback title, save failure) were not drawn. | Fixed. Home curation frames added to S127 desktop and mobile: type list with one line help each, checkbox with its own help, fallback title, failure state with Try again, launch order line. |
| F9 | S122, S129 | Major | Focus ring on the rating chip and the kebab was accent yellow over pastel thumbnails (about 1.2:1). | Fixed. 2 px white inner ring plus 3 px ink outline, 2 px offset. Visible on every thumbnail colour. |
| F10 | S123 | Major | Home rows showed exactly 5 cards with no peek (R11, 5.3 columns). | Fixed on desktop (sixth card peeks). Top 10 uses a numbered tile and keeps 5 for the board. |
| F11 | S129 | Minor | Row title "Continue watching" and kids "Keep watching" (R14 default is "Continue learning", configurable). | Fixed. Build reads the curated title, default as in R14. |
| F12 | S126, S127 | Minor | Option copy "12, from 12" says nothing. | Fixed to "12, ages 12 and up" and "15, ages 15 and up". |
| F13 | S126 | Minor | Forced colours frame used a 4 px offset. R37 says 3 px outline, 2 px offset. | Fixed. |
| F14 | S127 | Minor | R20 (labels default G, PG, 12, 15, 18, guests up to 12, options reducible by setting) not stated on the editor. | Fixed. Notes added to both S127 boards. |
| F15 | S127 | Minor | R30 names the bulk bar "Select all N that match" link. Bar had none. | Fixed. Link added, 44 px, light blue on dark navy (about 9:1). |
| F16 | Several | Minor | Kids badge is a yellow chip with no edge, invisible against a lemon page (1.4:1). Text stays readable because it sits on its own fill. | Fixed. 1 px ink border on `.kid`. |
| F17 | S120_m, S121 | Note | Mobile rating buttons and My List are icon only, with spoken names. A sighted newcomer sees thumbs without words. | Accepted as designed (plan finding 1). Build: `role="group"` with the accessible name "Rate this title", `aria-pressed`, and visible text from 960 px. |
| F18 | S124, S125, S128, S129 | Note | No reduced motion line on the popover open, the kebab menu, the Undo toast and the skeleton shimmer. S122 and S123 have them. | Build item below. |
| F19 | all | Note | Mockups use literal hex values. They match the default token set, the build must use `@ad/ui` tokens only. | Build item. |

Counts: Blocker 2, Major 8, Minor 6, Note 3. All Blockers and Majors are fixed in the mockups. No finding is left open in the mockups; the rest belongs to the build.

## What changed

Mockups (both in `docs/mockups/v2/L5/` and copied to `/home/claude/ad/project/`):

- S122: R10 scale 1.25 after 300 ms, origins, row padding note, wider spacing between columns, new peek scrim, readable focus ring, notes rewritten.
- S120 to S129: nav, logo and pill targets raised, kids chip border.
- S120: breadcrumb component per R32, category link 44.
- S123: sixth card peek in each five card row.
- S126: forced colours ring offset, option copy.
- S127: sidebar, bell, account link at 44, checkbox hit area, Select all link, R20 note, option copy, Home curation frames (desktop and mobile).
- S129: "Continue learning", kebab focus ring.

Plan: `docs/plan/v2/L5-engagement.md` M44-S03 AC1 now says 300 ms (R10) and UI finding 7 now defers to R10.

Re-measured after the changes: zero controls under 44 px on all 18 boards except the S127 row checkbox visual (hit area is 44), zero flat contrast failures, worst text on imagery 9.58 (S122), no page overflow at 1360, 390 or 360, no dashes or emoji. The lemon at 1.15 run shows no failed contrast and no clipped text apart from the intended scrolling rows and the two line description clamp in the card peek.

## What remains for the build

1. Hover card: scale only inside `@media (hover: hover) and (pointer: fine)` (R31), 300 ms delay, no delay on mouse out, `transform` and `opacity` only, `prefers-reduced-motion: reduce` removes the scale and slide. First visible card uses origin left, last visible card origin right. Rows need at least 16 px of vertical padding and the scaled card needs `z-index` above its neighbours. Keyboard focus within shows the peek and the scaled state at once with no delay (decision to log in `docs/DECISIONS.md`). Reveal the peek on `:focus-within` too (plan finding 5).
2. Tile focus (R37): offset outline 3 px, 2 px offset, plus `outline: 3px solid transparent` for forced colours on card and profile tile. In-image controls (rating chip, kebab, My List) use the white inner and ink outer ring.
3. Peek: scrim token, not a raw rgba. The G chip is hidden, other ranks show text on a solid chip. Contrast test on the lightest category colours.
4. Targets: nav link, logo link, breadcrumb (shared component, R32), admin sidebar, checkbox label, chip, pill, kebab menu items, "Select all N that match" all 44 px. Add one test that fails on any control under 44.
5. Rows: fractional columns 2.3, 3.3, 4.3, 5.3, 6.3 (R11), scroll snap, no hover only paging arrows on touch. The settings tab strip needs an edge fade so the clipped tab reads as scrollable at 360.
6. Skeletons after 300 ms with final geometry (Top 10 reserves the numeral width), static under reduced motion, `aria-busy`.
7. Reduced motion on bell popover, kebab menu, Undo toast, switch thumb and filter skeletons (F18).
8. Tokens only. Mockup hex values map to the default theme tokens. Test the theme editor with dark ink on lemon at 1.15 for every L5 screen.
9. Add `bell` icon, notification badge as text with spoken count, `role="group"` and `aria-pressed` on the rating group, `role="status"` toasts, errors persist.
10. Row titles come from curation (Continue learning default, R14). Maturity labels and the guest ceiling come from settings (R20). Platform name stays configurable (R02).
11. Native `select` and checkbox elements in the build. The mockups draw them as divs.

## Story acceptance the design cannot show

- M44-S01 AC3 (Undo for 6 seconds), AC4 revert timing, idempotent double tap, per profile ownership.
- M44-S02 AC2 every card of a title updates at once.
- M44-S03 AC1 timing (300 ms per R10, plan updated), Data saver neutrality.
- M44-S04 AC1 to AC4: intent storage, 15 minute expiry, tamper check, kids drop.
- M44-S05, S06 thresholds (10 ratings, 85 percent, top quarter), 15 minute rollup, CSV export.
- M44-S07 to S09 ranking maths, 3 plays per viewer per day, 3 hour snapshot age, cold start thresholds, ordered list announcement ("Number 3," is drawn but not the screen reader output).
- M44-S11 AC4 Data saver fetch, AC3 mark read on open. S12, S13 fanout, dedupe on a double job run, maturity filter.
- M44-S14 AC2 consent time recorded, AC3 email follows account email. S15 digest size, headers, suppression. S16 permission prompt only after a press.
- M44-S17 AC3 403 under kids lock.
- M44-S18 AC1 audit entry, AC3 all or nothing transaction.
- M44-S19 AC1 immediate effect on every list, AC2 and AC3 password rule, concurrency message.
- M44-S20, S22 enforcement on every path, fail closed, migration, `kids_safe` trigger.
- M44-S23 AC4 arrow key, Enter, Escape and focus return in the kebab menu (roles are drawn, behaviour is not).
- M44-S24 AC1 URL state, AC2 stable 24 item paging without repeats, offline first page.
- M44-S25 export, deletion, privacy page text, 60 day notice retention.

## Rulings check

R10 applied. R11 applied to S123, S128 grid and S129 not affected. R14 applied. R17 not in L5 (guest Kids mode toggle and kids My List guest copy belong to L1). R20 applied. R30 applied (incl. bulk bar link). R31 stated for build (mockups are static). R32 applied to the S120 breadcrumb. R37 applied. R38: the caption badge is not on any L5 card, the bulk bar has no disabled action in the L5 frames, there are no recovery codes on L5 screens, so nothing to change; the build must use a disabled token, not raw grey, when it adds the bulk bar disabled state.
