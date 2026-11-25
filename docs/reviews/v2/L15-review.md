# L15 UI review: Share sheet and Share placement (S200 to S203)

Reviewer: `angels-delight-design-system` checklist. Date: 25 November 2026. Inputs: `docs/DESIGN-SYSTEM.md` sections 3, 4, 6, 8, 11.12 (modal and bottom sheet), 11.13 (toast), 14 (copy), `docs/audits/2026-11-25-share-audit.md`, rulings R26 (kids and sharing), R30 (switch targets), R31 (hover only rules), R37 (focus offset). Decision D-391.

Method: every file was rendered with Playwright at 1360 (desktop) and 390 and 360 (mobile) using `docs/reviews/v2/tools/l9-audit.mjs` (a copy that blocks web fonts so it runs offline). It measures targets under 44 px, text contrast from computed colours, fonts under 12 px, dashes and emoji, and horizontal overflow. Contrast of pairs the tool cannot read (white text on the poster gradient) was computed by hand.

## Screens

| Screen | Files | Contents |
|---|---|---|
| S200 Share placement | d, m | Title page, series page, hero (round 44 px button after More info), hover card (third round button), card menu (Share row), watch page (beside My List), end screen (beside Watch again). |
| S201 Share sheet | d, m | m: default bottom sheet, focus ring, Copied, no device share menu (More hidden), clipboard blocked, swipe down in progress, short landscape phone. d: popover with arrow, copied, flipped near the right edge, no device share menu, centred dialog on a short window. |
| S202 States | d, m | Start at 1:23, kids profile (no Share), guest, offline, device share failed, very long title, Yoruba labels, Hausa labels. |
| S203 Link preview | d, m | WhatsApp card and sent text, Facebook card, the link rules. The tags themselves belong to lane L15b. |

## Decisions the mockups carry

- Always our sheet, never straight to the device sheet; the device menu is the last target, More, shown only when `navigator.share` exists (D-391).
- Eight targets: Copy link, WhatsApp, Facebook, X, Telegram, Email, Messages (SMS), More. Admin list and order from `seo.share_channels`; Copy link and More are fixed.
- Brand marks are drawn as `currentColor` glyphs on a neutral round tile. No brand hex is hardcoded, so the sheet follows any theme and passes contrast by construction.
- Kids profile and Kids mode: Share is hidden on every surface (R26, no external links for kids).
- Link: clean canonical address only, `?t=<seconds>` only when Start at is on.
- Status is a polite line inside the sheet, not a toast, because the sheet stays open after copying.

## Design points checked by hand

These were designed in from the start and checked, not found as defects: the status line lives inside the sheet (a toast would close with it); dragging starts only on the handle and header so the grid still scrolls; offline web targets are muted, focusable and explain themselves; the hero button is named "Share (title)"; the popover flips near the right edge.

## Findings

| # | Sev | Screen | Finding | Status |
|---|---|---|---|---|
| 1 | Major | S202 | The Start at switch was 48 by 28 px (R30 needs 44 high). | Fixed: the switch sits inside a 48 by 44 hit area with its name. |
| 2 | Minor | S203 | The WhatsApp card host line was 4.48 to 1 (needs 4.5). | Fixed: darker grey, 6.39 to 1. |
| 3 | Note | all m | The tool reports a 390 px scroll width at 360 px because mockup frames are fixed at 390, the same as every other mobile file. The grid uses `auto-fill` cells of at least 72 px, so it fits 320 px. Real widths 320, 360 and 414 are measured in the build tests. | Open (build test) |
| 4 | Note | S200, S203 | White text on the poster gradient is flagged as 1.00 because the tool cannot read gradients. Computed: 8.6 to 1 and 13.2 to 1. The build puts titles under the sheet header or a scrim, never over a poster. | Accepted |
| 5 | Note | S201 | The popover arrow is drawn in the mockup. The build omits the arrow and keeps the 8 px offset. | Accepted (logged here) |

## Checks (from the skill checklist)

Tokens only in the build (no hex or font names in the CSS): Pass. Contrast: text 5.2 to 14.1, ring 5.25, field border 3.32 (needs 3.0): Pass. Targets 44 px or more everywhere (cells 88 px high, close 44, Copy 44, field 44): Pass after fix 1. Focus: 3 px ring, inset on cells so the grid never clips it: Pass. Reduced motion: no slide, state still changes: Pass. Mobile first with min-width queries: Pass. Hover only rules inside `@media (hover: hover)`: Pass. Copy: plain, sentence case, no dashes or emoji: Pass. Skeleton and loading: Not applicable (the sheet has no data to wait for).

Verdict: Approve with minor fixes (both fixed). Counts: 0 blocker, 1 major (fixed), 1 minor (fixed), 3 notes.
