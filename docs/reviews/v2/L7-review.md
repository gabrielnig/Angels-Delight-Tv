# L7 design review: Languages (S140 to S149)

Reviewer: angels-delight-design-system skill. Date: 24 November 2026. Branch `review/L7`. Rulings applied: R23, R30, R31, R38 (and R32, R34, R39, R21, R02 where relevant). Mockups fixed in place in `docs/mockups/v2/L7/` and the generators in `/home/claude/ad/gen7`.

Method: all 18 boards rendered with Playwright (Chrome) at 1360 for desktop and 390 for mobile (360 spot checked). A script measured every link, button, input, switch and role element (44 px rule, R30), computed text contrast for every text node against its real background, and listed every off-token colour. Diacritics were inspected on padded 4x screenshots, and CDP platform font data was used to tell the shipped web font from a system fallback (the sandbox has system Inter, which would hide gaps).

## Verdicts

| Screen | Verdict | Notes |
|---|---|---|
| S140 Language picker (mobile) | Approve with minor fixes (fixed) | Targets under 44, 240 px header collapse missing. Added the 240 px frame, wordmark folds. Example now matches the S143 threshold scenario. |
| S141 Language picker (desktop) | Approve with minor fixes (fixed) | Menu rows under 44 (R30), hover not marked as fine pointer only (R31). |
| S142 Language settings | Approve with minor fixes (fixed) | Kids header, switch targets, breadcrumb (R32). |
| S143 Admin languages | Changes required, now fixed | Switches 28 px high and unnamed, tinted row edges under 3:1, banner and tag colours off token. |
| S144 Translate workspace | Approve with minor fixes (fixed) | Targets, focus state for textareas shown, disabled bulk actions use a token (R38). |
| S145 Import and export | Approve with minor fixes (fixed) | Yoruba characters in copy now carry lang="yo" so the right glyph path is used. |
| S146 Missing keys | Approve with minor fixes (fixed) | Targets, "Select all N that match" link at 44, bulk approve marked Admin only (R21). |
| S147 Caption list languages | Changes required, now fixed | Editor view and spoken language limit states were missing (M46-S15 partly). Added. |
| S148 Caption review translation | Changes required, now fixed | Detection banners missing, caption badge fill (R38), mono font token. Fixed. |
| S149 Player caption languages | Approve with minor fixes (fixed) | Seek hit area to 44 (R30), rail contrast shown at 3:1 (R34), Hausa cue renders in Inter (R23). |

No blocker remains in the mockups. Build blockers are under "What remains".

## Findings

| # | Severity | Screen | Finding | Fix |
|---|---|---|---|---|
| 1 | Blocker | S143, S144, S146 | Switches 28 px high (R30). | Hit box 44 high, 28 px track drawn by pseudo element, named. |
| 2 | Blocker | S143, S146 | Tinted rows had an edge under 3:1. | Edge uses switch-off tone (#6E7179). Becomes a token rule in the build. |
| 3 | Major | All | Links, icon buttons and menu rows under 44 (R30). | Padded to 44. Measured 0 offenders after the fix. |
| 4 | Major | S140 | No 240 px header collapse. | Added a 240 px frame: no overflow, wordmark folded, targets 44. |
| 5 | Major | S147 | No Editor view, no spoken language limits. | Both states added. |
| 6 | Major | S148 | No detection banners. | Added. |
| 7 | Major | S149 | Seek bar hit area short of 44 (R30). | Raised. Rail reaches 3:1 on the scrim (R34). |
| 8 | Major | S145 | Yoruba text without lang attribute fell back to a system face. | lang="yo" added. |
| 9 | Minor | S142 | Breadcrumb not on the R32 component. | Links min width 44, current crumb inline-block, line height 44. |
| 10 | Minor | S143, S148 | Banner, th and tag colours off token. | Moved to tokens in the shared override. |
| 11 | Minor | S144 | Disabled bulk bar actions on a one-off grey (R38). | Token used. |
| 12 | Note | Gallery | Chrome colours #5E3D00, #E9E8E1, #EEEDE7 are annotation, not product UI. | None. |

## Diacritics with the shipped fonts

- The shipped subsets lack the precomposed ẹ ọ ị ụ. Chrome composes them from the base letter plus U+0323 when the family has the combining mark. Inter, Nunito and Lora do. DM Sans and Poppins do not and fall back. Space Grotesk draws the dot below in the wrong place.
- Hausa ɓ ɗ ƙ ʼ are missing from five of six families. Inter has them.
- DM Sans has no vietnamese subset upstream, so the fix is not a cmap-only check. The plan overstates it as a cmap problem. It needs the per-glyph Inter fallback.
- The display stack ends in system-ui, not Inter. It should end in Inter.
- Rule applied in the mockups: Inter for yo and ig headings (R23) and, as a proposed extension, for ha headings. Rendered correctly on all boards, marks sit right in padded 4x shots.

## What changed

Generators edited in `/home/claude/tmp/L7rev/gen7` and copied back to `/home/claude/ad/gen7`, all 18 boards regenerated and copied to `docs/mockups/v2/L7/` and `/home/claude/ad/project/`. After: 0 target offenders, 0 contrast failures, off-token colours limited to gallery chrome and the R34 rail colour.

## What remains for the build

- Add Hausa ɓ ɗ ƙ ʼ and ₦ to the font coverage tests, NFD aware (R23).
- Per-glyph Inter fallback for DM Sans and Poppins. End the display stack in Inter.
- Extend R23 to Hausa headings (proposed).
- Wordmark hides below about 350 to 360 px.
- Add `--leading-marks` (plan slice 6) and the R34 player rail token (owned by L4, #6A6E78 is a stand in).
- Reduced motion (spinners and shimmer static) and hover inside `@media (hover: hover) and (pointer: fine)` (R31). The mockups are static, so these are not visible.
- Focus state for workspace textareas, and the "Select all N that match" link at 44.
- Replace the `[style*=...]` edge hack on tinted rows with a token rule.
- Test at a real 200 percent zoom (195 CSS px). The mockup frame is a fixed 240 px specimen, so 195 is not drawn.

## Story AC the design cannot show

- M46-S15 spoken language select: limits shown, the save and error round trip is not.
- M15-S01 AC4, M46-S18, S19, S02, S05: behaviour, persistence and import or export processing.
- Reduced motion, hover and live focus order, as above.
