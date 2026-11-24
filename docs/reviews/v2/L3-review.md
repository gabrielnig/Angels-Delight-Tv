# L3 design review: admin polish, bulk actions, captions control

Date: 24 November 2026. Reviewer: `angels-delight-design-system` skill. Branch `review/L3`. Inputs: `docs/plan/v2/RULINGS.md` (rulings win), `docs/plan/v2/L3-admin-polish.md`, mockups S100 to S109 (desktop 1360 and phone 390), `docs/DESIGN-SYSTEM.md`, the audit. Fixed mockups live in `docs/mockups/v2/L3/` and `/home/claude/ad/project/`.

How it was measured: every board rendered in Chromium through Playwright at 1360 (desktop) and 390 (phone); phone boards re-run at 360 with the board width forced to 360. A script measured every link, button, switch, input and menu row (target under 43.5px counts as a fail), computed WCAG contrast for every text node against its real stacked background, scanned for overflow, em and en dashes and emojis. Contrast pairs were computed from the token values.

## Verdict per screen

| Screen | Before | After | Notes |
|---|---|---|---|
| S100 Lists and tables | Approve with minor fixes | Approve | Brand link was 28px high. Sideways table at 360 scrolls inside its card by design (L3-D03). |
| S101 Breadcrumbs | Approve with minor fixes | Approve | Mockup already had R32 (links 44 wide, current crumb inline-block, ellipsis shown). The plan CSS did not; fixed in plan 14.1. Single crumb is a span, 39px wide, not a link. |
| S102 Selection bar | Changes required | Approve | Disabled actions used raw greys (R38). Select all link is 44px high (R30). Mixed state, 500 note, editor reason and More menu all present. |
| S103 Confirm dialogs | Approve with minor fixes | Approve | Inline "Show those 4 first" link was 17px high. |
| S104 Results, progress, undo | Changes required | Approve | "Nothing succeeded" panel offered Retry for a not ready item, against plan 4.2. Report links were 20px high. |
| S105 Captions bulk approve | Approve with minor fixes | Approve | R21 shown (editor disabled with reason). Report links were 20px high. |
| S106 Encoding and Failed encodes | Approve with minor fixes | Approve | Link height. Empty states, skipped row, run one at a time text present. |
| S107 Users, staff, series, trash | Changes required | Approve | Locked rows showed a disabled looking checkbox, now a 20px spacer (R33). Danger ink off token. Mobile locked card used an off token fill. |
| S108 Bulk upload | Approve with minor fixes | Approve | Switch was 26px high. Override table truncates Series (see F14). |
| S109 Captions on and off | Changes required | Approve | Switch 26px high, seek rail 1.77:1 (R34), phone title cards overflowed 10px at 360, switch hit area. R22 shown. |

Counts after fixes: 0 Blocker, 0 Major open, 4 Minor open, 3 Notes. Overall verdict: **Approve with minor fixes** (the open items go to the build as notes).

## Findings

| # | Sev | Where | Finding | Status |
|---|---|---|---|---|
| F1 | Major | all desktop boards | Admin brand link "ADTV Admin" 208 x 28 (R30) | Fixed, min-height 44 |
| F2 | Major | S104, S105, S106, S107 | Links inside report rows, table cells and lists 17 to 20px high (R30) | Fixed, inline-flex min-height 44; report rows now 44 |
| F3 | Major | S103, S105 | "Show those 4 first" link 17px high | Fixed |
| F4 | Major | S102, S108, S109 | Switch 44 x 26, target under 44 high | Fixed, 44px box with drawn track (plan 14.4) |
| F5 | Major | S109 | Seek rail `#3A3D46` on player surface 1.77:1, hit area 6px (R34, R30) | Fixed, `#6A6E78` 3.75:1, 44px hit area |
| F6 | Major | S109 phone | Two 171px title cards overflow to 370px at 360 | Fixed, flex 1 |
| F7 | Major | S102 and phone docks | Disabled bar actions used raw `#3A3D46` and `#C9CCD3`, and the muted note used `#C9CCD3` (R38) | Fixed, `--color-sidebar-active`, `--color-sidebar-muted`; text 5.86:1 and 7.98:1 |
| F8 | Major | S107 | Locked rows showed a greyed checkbox with raw `#B5B8BE` edge (R33) | Fixed, 20px spacer plus reason text |
| F9 | Major | S104 | Nothing succeeded panel said "Retry the 3 that failed" and listed a not ready item as failed; plan 4.2 says not ready is never retried | Fixed, "Retry the 2 that failed", item reads "Skipped. Not ready..." |
| F10 | Minor | S100 to S109 | Danger ink `#8E1B12` is a near duplicate of token `--color-danger-ink` `#8F1D13` | Fixed in mockups |
| F11 | Minor | S100 to S109 | Status text inks `#14568F`, `#14532D`, `#5E3D00` are not tokens (ratios 6.63, 7.99, 8.88, all pass) | Open for build: add tokens, plan 14.6 |
| F12 | Minor | S107 phone | Locked card fill `#F0EFEA` not a token | Fixed, `--color-surface-sunken` |
| F13 | Minor | S102, S104, S108, S109 | No reduced motion statement (dock slide, undo countdown, spinners, upload bars) | Fixed, one line on each desktop board |
| F14 | Minor | S108 | Per file override table cuts "Science made simple..." in a 120px cell | Open for build: Series column `min-width: 11rem` or wrap |
| F15 | Minor | plan 3.3 CSS | Breadcrumb crumb `min-width` missing and inline-flex current crumb cannot ellipsis (R32) | Fixed in plan 14.1 |
| F16 | Minor | plan 4 | Select all link, locked spacer and disabled token had no CSS (R30, R33, R38) | Fixed in plan 14.2 and 14.3 |
| F17 | Note | S102 | The More menu in the editor frame puts Captions for viewers in the bar, while admins see it in More. Same action, two places | Build: one rule, bar on desktop, More under 48rem |
| F18 | Note | S109 | Bulk captions menu shows a tick on On although 24 videos can be mixed | Build: no tick when the selection is mixed |
| F19 | Note | S102 phone | More sheet shows Move to Trash in neutral ink | Build: danger ink as on desktop |

Audit of the measure script: the S109 player time "1:46 / 5:02" is reported at 1.09:1 because it sits on a gradient image; it is white on a dark scrim (about 17:1), a false positive. Unfixed measures after the changes: S100 to S109, 20 boards, 0 targets under 44, 0 dashes, 0 emojis, 0 overflow at 360 other than the intended sideways table in S100 phone.

## Tokens, contrast, states (checklist summary)

- Tokens: all colours in the mockups are token values except the status inks (F11), the pastel thumbnail art (decorative), and `#FAFAF7` frame fill (mockup only). Fonts are Inter and Space Grotesk as the other boards.
- Contrast computed: muted on bg 5.77, muted on sunken 5.24, white on bar 17.74, yellow link on bar 11.55, danger ink on tint 7.80, on-primary 5.25, warning on tint 5.37, control edge `--color-border-strong` on bg 3.04, switch track against white 3.32, focus ring on surface 5.25, rail 3.75.
- States: default, hover (inside hover capable query in S101), focus (3px ring, yellow on dark), selected, disabled with reason, busy, error and empty are all present in S100 to S109. Not applicable: loading skeletons (these screens poll or render server side; skeleton rules stay in L8).
- Keyboard: focus rings drawn on crumbs, bar actions, rows and dialog fields; reason on focus of a disabled action (aria-disabled, not `disabled`).
- Copy: plain words, sentence case, no dashes, no emojis; errors name what happened and what to do ("Nothing was changed").
- Mobile first: 390 and 360 pass; 1360 desktop passes. The 768 breakpoint is not drawn; the build checks it (below).

## Story and finding AC visibility

Visible in the mockups: M42-S01 (S100, F1 to F3), S02 (S101), S03 and S06 (S102), S04, S05 and S07 (S104), S08 (S105), S09 (S106), S10 to S13 (S107), S14 to S16 (S108), S17 to S20 (S109), S21 (S102 and S109 bulk menu).

The design cannot show these; the build proves them in tests:
- S01 AC4 sticky first column behaviour while scrolling (static frame only).
- S02 AC4 every admin page starts with Admin linking to `/admin` (crumbs audit test).
- S03 AC4 selection kept across live refresh; S05 chunks, Cancel after the current chunk, offline resume; S06 filter snapshot of up to 500 ids and its clear on filter change.
- S07 compare and set on Undo; S22 audit rows (`bulk.run` plus item rows with the same bulk id) and denied rows.
- S08 AC3 each track approved through the normal path; S09 oldest first order; S10 to S13 server safeguards (own row, last Super admin, re-auth once, hour cooldown, 50 and 20 limits).
- S16 publish when ready never skips the caption gate; S17 AC3 gate satisfied when Off; S18 audit of old and new default; S20 AC1 the C key does nothing when captions are off, AC2 cross device memory.

## What changed

Mockups (all 20 files, both copies): items F1 to F13 above. Plan: new section 14 Amendments in `docs/plan/v2/L3-admin-polish.md` (breadcrumb, bulk bar, locked spacer, switch, links, tokens, rulings applied).

## What remains for the build

1. Breadcrumbs: use plan 14.1 verbatim. Playwright at 360, 390 and 1360: every crumb link 44 high and at least 44 wide, current crumb one line with a 120 character title, equal `top` for all crumb boxes.
2. Admin nav (R30): `.adm-nav a` already uses `min-height: var(--touch-target)`; add a Playwright check that every sidebar link, the brand link and the mobile drawer links measure 44 at the three widths. If any other admin rule sets 2.5rem, raise it.
3. BulkBar: plan 14.2. Select all N link class `adm-bulk__all`; disabled actions keep `aria-disabled="true"` so they focus and show the reason tooltip; the tooltip is `role="tooltip"` tied with `aria-describedby`.
4. Locked rows: plan 14.3 (`.adm-select-spacer`, reason as real text, no disabled checkbox).
5. Switch: plan 14.4. Replace any 26px switch in Site settings and the video editor.
6. Progress bars: `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and a text number beside it (S104, S106 and S108 bars are drawn without values; the markup in the mockups is decorative).
7. Tokens: add `--color-info-ink`, `--color-success-ink`, `--color-warning-ink` (plan 14.6) to tokens.css, DESIGN-SYSTEM section 3 and the theme editor Fixed group; log as decision L3-D15.
8. Series column in the override table (F14); More menu rule and mixed state tick (F17, F18); danger ink for Move to Trash in the phone sheet (F19).
9. Reduced motion: dock slide, undo countdown and spinners follow the statements on the boards; countdown width is the only thing allowed to animate beyond transform and opacity.
10. Check at 768 and at 200 percent zoom, which the boards do not draw.
