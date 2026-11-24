# L8 design system review (24 November 2026)

Reviewer: the `angels-delight-design-system` skill checklist, run by the L8 owner. Inputs: `docs/plan/v2/RULINGS.md` (rulings win), `docs/plan/v2/L8-design-system.md`, mockups S150 to S159 (13 files), `docs/DESIGN-SYSTEM.md`, the audit, and the L2, L4, L5 mockups for conflicts. Settled values and CSS are in section 13 (Amendments) of the L8 plan.

Method. Every mockup was rendered with Chromium (1440 wide, 400 wide for the mobile files) and read as text. Scripts: a WCAG contrast calculator over every ratio the mockups print plus the ones they imply, a bounding box scan for interactive elements under 44 by 44, a cubic bezier solver for the nav fade, a geometry script for columns, gutters, peek and hover growth at 17 widths, and a fontTools read of the shipped WOFF2 files for glyph coverage. Greps for em dashes, en dashes and emojis on all edited files came back empty.

## 1. Verdict per screen

| Screen | As submitted | After fixes | Notes |
|---|---|---|---|
| S150 rows and cards desktop | Approve with minor fixes | Approve | All printed geometry reproduced (peek 37 to 50 percent). Card progress rail now names `--color-card-progress-rail`. Button heights fixed (48) |
| S151 rows and cards mobile | Approve | Approve | The 42 by 29 "See all" found by the scan is the 600 px panel drawn at 0.65 scale inside a 400 px page, not a real target. Real one is 44 px tall |
| S152 nav states desktop | Changes required | Approve | Two real defects: linear scrim left white text at 2.84:1, and an eased fade made the 35 percent flip land at 50 percent opacity (2.84:1). Both fixed |
| S153 nav and tab bar mobile | Approve with minor fixes | Approve | Same nav scrim hold applied. Tab bar, 44 px targets and safe area are correct |
| S154 hover card desktop | Changes required | Approve with notes | Negative margin overlapped the row heading, hover buttons 36 px with no hit area, hover card active below 600 px where growth exceeds the gutter. Text fixed, CSS in 13.3. First and last child origin is a documented reading of R10 |
| S155 focus sheet (desktop and mobile) | Changes required | Approve | Tile offset was 3 px (R37 says 2 px). Rail finding turned into the R34 ruling, with the buffer and card rail knock-ons |
| S156 tokens desktop | Approve with minor fixes | Approve | New fixed tokens added to the colour sheet. `lg` button height corrected to 48 |
| S157 tokens mobile | Changes required | Approve | Coverage table ignored Hausa and the Yoruba tone letters. Seven rows added and the R23 language rule written. Table figures for the rows it had were all correct |
| S158 skeleton, empty, error (desktop and mobile) | Approve with minor fixes | Approve | Playback error advice and its single action disagreed. Copy now "Try again, or use another browser or device." |
| S159 hero scrim (desktop and mobile) | Changes required | Approve | More info lacked the white border (R12), arrows missing beside Pause (R12), Data saver variant contradicted L2 S93, two loop stop missing, `lg` button 52 px |

## 2. Findings

Severity: Blocker breaks accessibility or a binding rule, Major is a wrong spec or missing state, Minor is a drift that should be fixed soon, Note is information.

| ID | Severity | Where | Finding | Resolution |
|---|---|---|---|---|
| R1 | Major | S152, S153 nav | Nav scrim fades 0.85 to 0 linearly over the bar, so the text centre sits at alpha 0.43. White on a white image there is 2.84:1, under 4.5:1 for 16 px links. The printed 12.63:1 was measured at the top edge only | Scrim holds 0.85 to 70 percent of the bar (alpha 0.595 at the lower text edge, 4.94:1). Mockup gradients and text fixed, CSS in 13.5 |
| R2 | Major | S152 fade | The fade used `--ease-standard` while the text flip was a time based 35 percent. With that curve opacity is 50 percent at 70 ms, so white text is 2.84:1 and ink 5.99:1 at the flip, and white is under 3:1 for the 20 ms before it | Fade is `linear` (time equals progress). Flip delay 70 ms to solid and 130 ms to clear, written as `calc(var(--motion-base) * 0.35)` and `0.65`. Worst frame 3.98:1 |
| R3 | Major | S159, L2 S90 | More info drawn as white 16 percent fill with no border. R12 says translucent with a white border. L2 draws `rgba(scrim, .6)` plus a 1px white border, which is right | Token `--color-hero-chip-bg`, 1px `#FFFFFF` border, white text 5.03:1 even over a white image. Mockup fixed |
| R4 | Major | S159 | Arrows beside Pause (R12) were missing from the control sheet | Added to the rotating and paused variants, 44 px circles from 960 |
| R5 | Major | S159 | Data saver variant said one slide and no dots. L2 S93 and R12: no rotation, no Pause, dots, arrows and swipe still work, next image not prefetched | S159 corrected, rule table lists the two loop stop |
| R6 | Major | S155, R37 | Tile focus offset 3 px. R37 says 3 px outline with 2 px offset (ring then judged on the page, 4.81:1) | Mockup and CSS corrected, forced colours path in 13.4 |
| R7 | Major | S155 rail, R34 | Rail 1.77:1 on the player. R34 gives `#6A6E78` (3.75:1). The ruling alone breaks two things: buffered `#5B606B` becomes darker than the rail (1.24:1), and card progress that reuses the rail token would turn grey | New buffer `#9A9FAB` (1.93:1 over the rail), new `--color-card-progress-rail` `#3A3D46`. Accent on the new rail is 3.32:1, still over 3:1 |
| R8 | Major | S157, R23 | Coverage table omitted Hausa and the tone letters. fontTools shows only Inter has ɓ ɗ ƙ ƴ, and the vietnamese subset does not add them. Space Grotesk, DM Sans, Poppins and Lora lack ǹ ḿ; DM Sans, Poppins and Lora lack ṅ | Seven rows added to S157. Inter is the display font for yo, ig and ha, NFD aware test, baseline table pinned in 13.7 |
| R9 | Major | S154 | Negative margin to hide the hover padding pulls the list 15.9 px over the row heading. The list is later in the DOM, so it steals clicks from the See all link, and a card raised under the link would flicker | Real padding, row gap reduced by the same amount (never below 0). No negative margin. CSS in 13.3 |
| R10 | Major | S154 | Growth per side is `0.125 x card width`. At a 599 px row (2.3 columns, gutter 24) that is 29.4 px, so a first visible card cuts off at the screen edge. From 600 up the growth always fits the gutter | Hover card off below a 600 px row container; invariant test from 600 up |
| R11 | Major | All L8 mockups | `.btn.lg` drawn 52 px. The token is 3 rem (48 px) and L2 draws hero buttons at 48 | CSS and inline sizes fixed in all files |
| R12 | Minor | S154 | Hover buttons 36 px visible with no stated hit area, so focus-within (no scale) was under R30 | 44 px `::before` hit area at rest, 45 px visible once scaled |
| R13 | Minor | R10, S154 | R10 says origin left for the first visible card and right for the last. CSS only knows list position | Origin is set for the first and last card of the list. The gutter invariant (R10 finding above) gives the same visible result for a scrolled row. Flagged for the owner in section 5 |
| R14 | Minor | S150, S150 table | Peek is 37 to 50 percent, not the 30 percent the fraction implies (the open right gutter adds to it) | Documented. Gate: 30 to 55 percent at eight widths. No formula change (R11 stands) |
| R15 | Minor | S158 | Playback error says "Try another browser or device" under a single "Try again" action | Copy now says both ("Try again, or use another browser or device.") |
| R16 | Minor | S155 | Tile hover ring on the peach avatar is 2.92:1 | Accepted: hover is not required information. Hover ring carries a transparent outline for forced colours |
| R17 | Minor | R38 | `--font-mono` already exists in `tokens.css` and the skill reference file. DS section 3 has no row for it | No new token. Add the DS row in the S01 docs slice |
| R18 | Minor | R38 | Bulk bar disabled buttons use raw `#3A3D46` and `#C9CCD3` (L3 S102, S105) | Tokens `--color-bar-disabled-bg` and `-ink`, 6.75:1 |
| R19 | Note | L3 | DS 4.2 rule 5 prefers an enabled action that explains on press over a disabled one. The bulk bar uses disabled | L3 owner decides. Token exists either way |
| R20 | Note | R39 | S20, S24 and S33 had two actions, an inline reference code and "Tap My List" copy | Edited in the shared project folder: S33 and S24 keep one action, reference moved to caption text, S20 copy is "Tap the plus on any video to save it for later." These files are not in git |
| R21 | Note | Touch scan | No real interactive element under 44 by 44 in any L8 mockup. The only hits were scaled schematics (S156 small and medium samples with their 44 px hit overlay, S159 miniature heroes, S151 600 px panel) | None needed |
| R22 | Note | Contrast | All printed ratios reproduced within 0.02: scrim stops 12.63, 6.01, 4.53, 3.07; nav frames; avatars 2.92 to 3.78; idle dot 5.64; accent on scrim 8.22; ring on bg 4.81; muted on surface 6.31 | None needed |

## 3. Conflicts with the L2, L4 and L5 mockups

| Lane | Item | Their value | Settled value | Owner action |
|---|---|---|---|---|
| L2 S96 | Hover card | Portal above the row, origin first and last visible card, closes on scroll | In place thumb scale, CSS origin, 13.3 | L2 mockup and plan adopt L8 (R10) |
| L2 S90 | Hero scrim | 0.88 to 46 percent, 0 at 74 percent (desktop). 0.9 to 64 percent, 0 at 90 percent (mobile) | 0.85 hold 40, 0.45 at 60, 0 at 100. Mobile 0.85 hold 50, 0.45 at 65, 0 at 80 (R36) | L2 uses the scrim tokens. Text block must stay inside the 54 percent and 60 percent limits |
| L2 S90 | Dots | Dot fill shows time left | L8 shows the current dot as accent 12 px | Compatible if the progress fill stays inside the accent dot. L2 decides the look, L8 owns the 44 px hit area and colours |
| L2 S90 | Pause label | Visible "Pause", Resume while focus holds it | L8 label "Pause slideshow" | Visible text must be contained in the accessible name (WCAG 2.5.3). Keep "Pause" visible and name it "Pause slideshow" |
| L2 S94 | Gutter and peek | Fixed 48 px, 236 px cards, peek 72 px | `clamp(1rem, 4vw, 3.5rem)` gives 51.2 at 1280 and 56 at 1440. Peek 106 to 120 px | L2 updates numbers |
| L2 S94, S96, S97 | Row link copy | "View all" | "See all" (DS, `Row.tsx`) | L2 mockups say "See all" |
| L2 S94 | Paging | Whole number of cards | Same, `max(1, floor(visible) - 1)` | None. L8 S150 wording aligned in 13.2 |
| L4 S110 to S119 | Seek rail and buffer | 5 px rail `#3A3D46`, buffer `#5B606B` | 4 px rail (8 hovered) `#6A6E78`, buffer `#9A9FAB` (R34) | L4 updates the mockups and the player CSS |
| L5 S122 | Hover card | 500 ms delay, 4 px lift, no scale, peek is decoration and Play is in the peek | 300 ms, 1.25 scale, 250 ms (R10) | L5 mockup and plan adjust. Rating chip and My List stay as real buttons beside the card link |
| L5 S122, S123, S129 | Caption badge | 24 px high inline badge, 1.5 px `#5B606B` border | Surface fill, ink text and 1px ink border on the thumb (R38). Inline in meta rows is fine | L5 adopts the badge on thumbnails |
| L5 S129 | Progress rail | 4 px `#3A3D46` | Same, now `--color-card-progress-rail` | None |
| L10 S173 | Google button | Brand colours inside an inline SVG | Allowed as the one exception, one component (13.4) | L10 imports `GoogleMark` |
| L3 S102 to S106 | Bulk bar disabled | Raw greys | Tokens (R38) | L3 uses the tokens |

## 4. What changed

Mockups (in `docs/mockups/v2/L8/` and copied to `/home/claude/ad/project/`): `.btn.lg` 52 to 48 and More info chip with the white border in every file; nav scrim hold in S152 and S153 plus the explanatory text; linear fade and flip delays in S152; tile offset and the rail ruling in S155 (both files); rail token name in S150; token swatches in S156; hover card wording and the Row gap line in S154; Hausa and tone rows and the R23 ruling in S157; playback copy in S158 (both files); arrows, Data saver variant and two loop stop in S159. Outside git, in `/home/claude/ad/project/`: S20, S24, S33 (R39).

Docs: `docs/plan/v2/L8-design-system.md` gains section 13 Amendments (token table, CSS and rules for R10, R11, R23, R34, R35, R36, R37, R38). This file is new.

## 5. Final token table

| Token | Value |
|---|---|
| `--cards-visible` | 2.3, 3.3 (600), 4.3 (960), 5.3 (1280), 6.3 (1920) |
| `--page-gutter` | `clamp(1rem, 4vw, 3.5rem)` |
| `--card-gap` | 0.5rem, 0.75rem from 960 |
| `--card-scale` | 1.25 |
| `--hover-card-delay` | 300ms (alias `--hover-intent-delay`) |
| `--motion-hover` / `--motion-press` | 250ms / 0ms |
| `--ease-out-strong` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--button-height-sm` / `-md` / `-lg` | 2rem / 2.5rem / 3rem |
| `--color-player-rail` | `#6A6E78` (3.75:1 on player) |
| `--color-player-buffer` | `#9A9FAB` |
| `--color-card-progress-rail` | `#3A3D46` |
| `--color-bar-disabled-bg` / `-ink` | `#3A3D46` / `#C9CCD3` (6.75:1) |
| `--color-hero-chip-bg` | `rgba(14, 15, 19, 0.6)` |
| `--scrim-rgb` | `14, 15, 19` |
| `--scrim-hero-start` / `-mid` / `-end` | 0.85 / 0.45 / 0 |
| Hero stops desktop (hold, mid, end) | 40%, 60%, 100% |
| Hero stops mobile (hold, mid, end) | 50%, 65%, 80% |
| `--nav-scrim-hold` | 70% |
| Nav underline clear / solid | `--color-focus-ring-dark` / `--color-primary` |
| Nav flip | 35 percent of a linear 200 ms fade: 70 ms in, 130 ms out |
| Tile and card focus ring | 3px outline, 2px offset, `Highlight` in forced colours |
| `--font-mono` | system monospace stack (already shipped) |
| Google mark | the one brand colour exception, `GoogleMark.tsx` only |
| Font rule | Inter is the display font for yo, ig, ha; NFD aware coverage test with a pinned gap table |

## 6. What remains for the build

1. Slice S01: DS section 3 rows for every token above (including `--font-mono`), section 5.1 vietnamese note, section 8 hover card and hero wording, 11.8 nav colours and fade, 11.22 rail colours. Mirror into the skill reference `tokens.css` in the same commit.
2. Gate tests to add: peek 30 to 55 percent at eight widths; hover growth fits the gutter from 600; nav text and underline contrast at the two stable states (no sampling inside the fade); hero white text at alpha 0.57 and text zone limits measured in Playwright at 360, 390, 960 and 1440; font coverage pinned table; contrast pairs listed in 13.1; colour gate allowlist for `GoogleMark.tsx` only.
3. Real device checks no test proves: nav fade on a mid range Android over throttled 4G; Windows high contrast rendering of tile, card and button rings; screen reader pass on a row with an `aria-hidden` peek; Yoruba, Igbo and Hausa titles in all six fonts at 360 px; the three lightest real hero images against the scrim.
4. Other lanes must apply section 3 (L2, L3, L4, L5, L10). Until they do, the mockups of those lanes disagree with the contract and the L8 values win.
5. Owner awareness: R10 asks for the origin on the first and last visible card. The build sets it on the first and last card of the list and relies on the gutter invariant for a scrolled row. If a real device shows a clipped card, add `data-edge` from an IntersectionObserver (about 20 lines) rather than loosening the invariant.
6. Risk to watch: moving `--color-player-rail` to a lighter grey changes every consumer. Grep `--color-player-rail` and `--color-player-buffer` before merging S09 and repoint card progress to `--color-card-progress-rail`.

Verdict: Approve after the fixes in this PR. No blockers remain for the build. Open items needing another lane: section 3 conflicts (L2, L4, L5 mockups and plans), and the L3 choice between disabled and explain-on-press bulk actions.
