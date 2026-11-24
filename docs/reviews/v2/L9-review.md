# L9 UI review: monetization, sponsors and donations (S160 to S169)

Reviewer: `angels-delight-design-system` checklist. Date: 24 November 2026. Inputs: `docs/plan/v2/RULINGS.md` (rulings win), `docs/plan/v2/L9-monetization.md`, `docs/DESIGN-SYSTEM.md`, the audit (sections 2, 3, 5), the 26 mockup files in `docs/mockups/v2/L9/` (S160 to S168 desktop and mobile, S169 as settings, transparency public, transparency admin and manage monthly). Rulings applied: R25, R30, R31, R38 (R34 to R37 do not touch these screens).

How it was measured: a Playwright script (`docs/reviews/v2/tools/`) rendered every file at 1360 (desktop), 390 and 360 (the 390 frames forced to 360, then every element checked for horizontal overflow). Per file it measured the box of every link, button, switch, input and role element (under 44 px), the contrast of every text node from computed colours composited over its ancestors (WCAG formula, large text 3:1), fonts under 12 px, and dashes and emoji. A second script rendered every sponsor card at 360, 390 and 1360, with the theme size factor forced to 1.0 and 1.15, and read box size, clipping, label width and truncation. Edge and chip pairs on tinted or gradient backgrounds were computed by hand with the same formula (plan section 16.3). Before and after numbers are below.

## Verdict per screen

| Screen | Verdict | Note |
|---|---|---|
| S160 Home banner (d, m) | Approve after fixes | Header links were 26 px (R30). Label overflowed its column at 360. Lemon state had not applied 1.15 and its card edge was 2.90:1. All fixed. States present: image, Data saver text, skeleton, image error, no sponsor, focus, long text, lemon, kids. |
| S161 Title card (d, m) | Approve after fixes | Same header, label and token fixes. Kids is only a text note here, S160 and S162 draw it. |
| S162 Player cards (d, m) | Approve after fixes | Kids state added. Before card chip centred. Reduced motion text state is present. Focus moves to Skip, Escape skips. |
| S163 Sponsors list (d, m) | Approve after fixes | Sidebar 40 px, bell 40 px, account link 32 px (R30). Status chips already carry icon and word. |
| S164 Sponsor editor (d, m) | Approve after fixes | Desktop preview was squeezed (label "Sponsored by S", headline clipped), phone editor drew a compact card under a "Desktop" label. Warning symbol replaced by an icon. Name hint added. |
| S165 Sponsor report (d, m) | Approve after fixes | Sidebar fix, axis labels 12 px. Chart colour 5.25:1 on white, one series, a text table sits beside it. |
| S166 Donate (d, m) | Approve after fixes | Header 44, "See how gifts are used" 44, switches had a 32 px target and no name, bank details looked real. Kids, Paystack unreachable, test mode, USD, redirect and 404 states present. |
| S167 Thank you and receipts (d, m) | Approve after fixes | Failed state had two actions (R39). Header 44. Receipt reads "acknowledgement, not a tax receipt". |
| S168 Donations admin (d, m) | Approve after fixes | Sidebar 44, `--font-mono` for references and masked emails. Status icon plus word, test mode banner, masked email with Reveal. |
| S169 Monetization settings (d, m) | Approve after fixes | 11 switches were 28 px tall and unnamed. Now 48 by 44 with names. Everything is off by default, turning sponsors on asks for a password. |
| S169 Transparency public (d, m) | Approve after fixes | Header 44. Kids behaviour decided (plan 16.5). |
| S169 Transparency admin (d, m) | Approve after fixes | Sidebar 44, switches fixed. Disabled Publish gives its reason. |
| S169 Manage monthly gift (d, m) | Approve after fixes | Header 44 only. |

No screen is rejected. No blocker remains in the design. The build blockers are in "What remains for the build".

## Findings

| # | Sev | Screen | Finding | Status |
|---|---|---|---|---|
| 1 | Blocker | S160 lemon | Card edge `#8A8D94` on the lemon page `#F7F3A6` is 2.90:1 (needs 3:1). The theme gate (4.3) derives a darker edge, the mockup used the default. | Fixed, `#80838A` is 3.31:1 |
| 2 | Major | S160 to S164 | Text size 1.15 was never applied. At 1.15 the wide card needs 112 px of content in a 104 px inner box, so the body line clips. | Fixed, heights scale with `--type-scale` (compact 112 to 128.8, wide 136 to 156.4), zero clipping at both factors |
| 3 | Major | S160 to S164, m | Label chip `Sponsored by Slate Books` is 185 px but the text column at 360 was 166 px, with `nowrap`, so the label ran out of its column and was cut by the card. The label is the compliance marker. | Fixed, "Sponsored by" never truncates, only the name ellipsizes, padding 12, image 72, gaps 10, chevron 20 (column 190 px) |
| 4 | Major | S160, S161, S166, S167, S169 (6 files, d) | Header links 43 to 54 px wide and 26 px tall, logo 28 px (R30). | Fixed, 44 by 44 minimum, underline drawn inside the box |
| 5 | Major | S163 to S165, S168, S169 (8 files) | Sidebar links 40 px, bell 40 px, account link 32 px (R30). | Fixed, 44 |
| 6 | Major | S166, S169 | 42 switches had a 28 or 32 px element (hit area only through a `::before`) and no accessible name or tab stop. | Fixed, element is 48 by 44 (52 by 48), named, `tabindex` |
| 7 | Major | S164 | Desktop and Data saver previews were drawn in a 440 px panel so the card squeezed to a 118 px text column. The phone editor showed a compact card under the label "Desktop". Misleading preview. | Fixed, drawn at 960 px shown at 45 percent, phone editor shows phone previews only |
| 8 | Major | S167 | Failed gift state had two actions, "Try again" and "Back to Home" (R39). | Fixed, one action |
| 9 | Major | S162 | No kids state for the player (R25, M48-S13). | Fixed, state added in both files |
| 10 | Major | S166, S167, S169, S160 to S165 | Sample bank details (`Sample Bank`, `0123456789`), organisation name, support email and sponsor names looked real, none marked as client input (R25). | Fixed, bracketed placeholders, `data-client-input`, a "Client input" notice at the top of every mockup |
| 11 | Minor | S164 | Date error used a text warning symbol (flagged by the emoji grep). | Fixed, SVG icon with the words |
| 12 | Minor | S165 | Chart axis labels 11 px and they carry values. | Fixed, 12 px |
| 13 | Minor | S166 to S169 | Monospace stack typed inline in 10 files (R38). | Fixed, `var(--font-mono)` |
| 14 | Minor | S162 desktop | Label chip left aligned above centred content in the before card. | Fixed |
| 15 | Minor | all | No `hover: hover and pointer: fine` or `prefers-reduced-motion: reduce` rules existed (R31). | Fixed, shared block added |
| 16 | Minor | S164 | Sponsor name hint did not say what fits a phone. | Fixed, "Under 20 characters fits small phones" |
| 17 | Open, build | S166, S164, S169 | Radio presets, checkboxes (`span.chk`), inputs (`div.in`) and switches are spans in the mockup. | Build, native `<input>` with `<label>`, arrow keys on the preset group |
| 18 | Open, build | S167 | Success page shows the reference and masked email. A guest without the receipt token must see neither. | Build, plan slice 9 test exists, keep it |
| 19 | Open, build | S160 to S162 | Skeleton after 300 ms, `aria-busy`, no shift (CLS 0) cannot be shown on a still. | Build, `vitals` check |
| 20 | Note | S160 to S165 | 90 items at 11 px are the mockup "State:" tags and admin sidebar group labels (micro text, no essential information). | Note |
| 21 | Note | S162 m | Player frames are fixed at 390 px in the mockup. Forced to 360 nothing overflows. Build is fluid. | Note |
| 22 | Note | S166 | "Help keep Angels Delight TV free" uses the platform name as sample copy. Build uses the configured name (R02). | Note |
| 23 | Note | all | Mockups use hex values and Inter literally, as every other mockup does. The build uses tokens only. | Note |
| 24 | Note | S164 | Icon stroke is 2, DESIGN-SYSTEM section 9 says 1.5. Same as L10 note 16, L8 settles it. | Note for L8 |

Counts: 1 Blocker, 9 Major, 6 Minor, 3 open for the build (17 to 19), 5 Notes. The Blocker, all 9 Major and all 6 Minor design findings are fixed.

## Measured before and after

| Check | Before | After |
|---|---|---|
| Interactive elements under 44 px, all 26 files | 166 (header 4 per desktop file, sidebar 16 per admin file, 42 switches, a link) | 0 |
| Text contrast under AA (computed, HTML text) | 0 | 0 |
| Card edge on lemon page | 2.90:1 | 3.31:1 |
| Sponsored label ink on chip | 14.15:1 | 14.15:1 (fixed tokens) |
| Sponsor card clipping at 1.15 | wide card clipped, compact label overflowed | none, compact 360 and 390, wide 1360 |
| Compact card box (360, 390) | 112 | 112 at 1.0, 128.8 at 1.15 |
| Wide card box (1360) | 136 | 136 at 1.0, 156.4 at 1.15 |
| Skeleton height versus card | equal | equal at both factors (same tokens) |
| Horizontal overflow at 360 (frames forced) | none | none |
| Emoji or symbol characters, en and em dashes | 3 files with a text symbol | 0 |

Sponsor label contrast was measured for every theme in plan 16.3. The chip has its own fixed fill and ink, so no theme can change the 14.15:1 ratio. Layout shift: the box height is a token decided on the server, the skeleton, image error and text card use the same token, and the no sponsor state renders nothing, so nothing moves after hydration. Kids surfaces: S160 (kids home), S162 (kids player, new) and S166 (kids "Ask a grown-up", no Donate button in the header) all show no sponsor and no donate.

## Settled questions

- Phone card: arrow with an accessible name, not a text button. Reasons and revisit trigger in plan 16.2 (D-M48-21).
- Sponsor tokens, values and groups: plan 16.1. Edits for `tokens.css`, DESIGN-SYSTEM 3.1, the theme editor group and the skill token copy are listed there.
- Slot boxes scale with the size factor, so the factor 1.15 theme passes with no clipping and no shift.
- Label truncation rule: only the name shortens.
- Kids and the public transparency page: treat as a donation surface, answer a kids context with "Ask a grown-up" (plan 16.5, reversible).

## What changed

All edits are in `docs/mockups/v2/L9/` and mirrored into `/home/claude/ad/project/`: shared CSS (sponsor tokens, scaled heights, label parts, hover and reduced motion rules, nav, switch, `--font-mono`, client notice), the compact card geometry, the lemon state at 1.15 with the derived edge, header, sidebar and link targets, 42 named switches, S162 kids state and chip, S164 previews, icon and hint, S165 axis size, S167 failed state, placeholders. The plan gains section 16. The scripts are in `docs/reviews/v2/tools/`.

## What remains for the build

- Add the sponsor tokens before slice 5 (plan 16.1) with a test that reads `tokens.css` and checks the six names and the Fixed group.
- Real `<a>`, `<button>`, `<input>` and `<label>` elements. `:focus-visible` ring from tokens. Hover only inside `@media (hover: hover) and (pointer: fine)`. Reduced motion uses `reduce`.
- Sponsor card: one `<a rel="sponsored noopener noreferrer">`, accessible name `Sponsored by NAME: HEADLINE. CTA`, chevron `aria-hidden` below 960, text button from 960. Edge from `--color-border-strong` after the theme gate. Slot height from the tokens, same for skeleton, error and text card.
- Before card: focus to Skip on open and back to Play on close, Escape skips, polite live region, static "Continues in N s" under reduced motion. Not a focus trap.
- Donate: preset radio group with arrow keys and 44 px targets, custom amount validated on blur then change, switch as `role="switch"` with the label, button text states amount and cadence, no pre ticked extras, no countdown.
- Strings in `@ad/shared/messages`. Platform name, organisation name, bank details, support email and sample sponsors never hardcoded (R02, R25).
- Kids matrix test (plan slice 14) gets rows for the player cards, the footer, the transparency page and the manage monthly link.
- Theme editor: show the derived edge and the scaled box heights in the preview, add the sponsor tokens to the Fixed group.
- Findings 17 to 19.

## Story AC the design cannot show

- M48-S01 to S08: persistence of switches, password check when turning sponsors on, audit entries, status derivation at Lagos midnight, link validation (https only, no open redirect), cap cookie contents and the rule that a capped slot renders nothing.
- M48-S09 to S12: insertion after row N and never above row two, one banner per page, impressions at 50 percent for 1 second, player card never delays Up next, no watch time counted during the before card, fresh start only.
- M48-S13: fail closed in five places, 404 and 204 on click and impression routes for kids, no cookie, no request. Only the visible result is drawn.
- M48-S15 to S17: impression dedupe, bot and preview exclusion, click redirect by id, Data saver and slow connection detection.
- M48-S18 to S21: report queries, CSV, print layout in a browser, previews that do not count.
- M48-S24 to S30: Paystack redirect, raw body signature check, amount and currency re-verification, idempotency, receipt email once, thank you page that ignores the query string.
- M48-S31 to S32, S35, S37, S39 to S44: subscription lifecycle, test and live key guard, reconcile job, USD and bank transfer settings, abuse limits, retention and the privacy notice.
- Performance claims: CLS 0, tracker under 1.5 KB, skeleton after 300 ms, no layout work under reduced motion.
