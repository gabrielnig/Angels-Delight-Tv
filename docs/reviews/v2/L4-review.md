# L4 UI review: player features (S110 to S119, plus the older player boards S22 to S26)

Reviewer: `angels-delight-design-system` checklist. Date: 24 November 2026. Inputs: `RULINGS.md` (rulings win), `docs/plan/v2/L4-player.md`, `docs/DESIGN-SYSTEM.md` (3, 4, 8, 11.21 to 11.23, 13, 14), the Netflix audit, mockups S110 to S119 and the older boards S22 to S26. Rulings applied: R15 (autoplay default), R16 (AirPlay behind a spike, Chromecast not built), R30 (44 px), R31 (hover guard, standard `reduce`), R34 (seek rail 3:1), R39 (one action per error).

## How it was measured

A Playwright script (real Chrome) rendered every file at 1360 (desktop), 390 and 360 (mobile frames, the 390 frame width forced to 360 and every element checked for overflow past the player frame), and 844 (phone landscape). Per file it measured:

- Contrast of every text node (2,565 across the final run) against its real background. The background is rebuilt from every layer under the text at its centre point, gradients are sampled at the text position, and the lightest part of the sample picture is used for frames without a scrim (DESIGN-SYSTEM 4.2 rule 6). Normal text 4.5:1, large text 3:1. A layer that paints over the text (for example a scrim above a button) is reported as well.
- The seek rail colour against the real composite under it (scrim over the lightest frame) for every rail segment, plus the token maths against the player surface.
- Box size (`offsetWidth` and `offsetHeight`, so press-scale transforms do not hide a short target) of every button, link, slider, switch, menu row, input and tab: 44 by 44 minimum.
- Overflow at 360 inside every player frame.
- Greps for em and en dashes, emojis, `outline: none`, and a reduced motion note per file.

Final run: 0 contrast failures and 0 targets under 44 px in all 23 files at every width. Three items the script still prints are not defects: S26 text under the modal backdrop (inactive page behind a dialog), the S26 rail at 2.98:1 under that backdrop, and one S119 mobile line the script cannot hit at 360 (a bold run inside a note, visually checked).

## Verdict per screen

| Screen | Verdict | Note |
|---|---|---|
| S110 Skip buttons (d) | Approve after fixes | Focus ring was yellow only (1.06 to 1.24:1 on a bright frame), now two ring. Rail lifted (R34). Live region copy matched to M43-S01 AC6. Tab order note added. All label variants, states and the no marker case present. |
| S111 Skip, portrait (m) | Approve after fixes | Same fixes. Target zone, tile offset and hidden controls case present. Fits 360. |
| S111 Skip, landscape | Approve after fixes | Skip button overlapped the seek hit area by 9 px (now 8 px clear). Title was white on bare sky at 1.52:1, now on a top scrim at 13:1 or better. Safe area drawn. |
| S112 Chapters (d) | Approve after fixes | Rail lifted, the two edge clamp frames were missing the scrim, menu raised clear of the hit area. Tooltip, menu, long title, no chapters, focus all present. |
| S113 Chapters (m) | Approve after fixes | Switch rows now the control with a 44 px row. Hit zone annotation no longer tints the rail. Fits 360. |
| S114 Layout and cast (d) | Approve after fixes | AirPlay marked as behind a device spike (R16), Chromecast not built. Theatre diagram was clipped. Added the full screen top bar (plan finding F12). |
| S115 Settings (d) | Approve after fixes | Switch rows semantic and 44 px, Autoplay default noted (R15), added the Autoplay save failure with rollback (M43-S11), caption cue moved above the scrim. |
| S116 Settings (m) | Approve after fixes | Kids sheet showed Autoplay next On, now Off (R15). Failure toast overflowed 360 by 22 px. Rollback case added. |
| S117 Up next (d, m) | Approve after fixes | Added the kids profile end card (R15) and tile states with the focus fix. Countdown, cancel, still watching, related next, Data saver, reduced motion present. |
| S118 Errors and low data (d, m) | Approve after fixes | Already one action per error (R39). Reference format fixed to `Reference: AD-7K4Q`, focus now drawn on the action, added the Data saver save failure (M43-S15). Locked quality toast overflowed 360. |
| S119 Admin editor (d, m) | Approve after fixes | Breadcrumb was plain text (R30, R32), brand link 28 px, missing errors for intro under 3 s and past the end, no empty chapter list, no Site settings field for the countdown (M43-S13). All added. |
| S22 Watch (m, landscape) | Updated, approve | 4 px rail and 16 px thumb, 3 button bar, scrim, back and title not in safe area. Brought in line with S111 and S118. |
| S23 Menus (d, m) | Updated, approve | Speed and Quality bar buttons removed, menus now open from Settings as submenus (L4-D10). Mobile sheet matches S116. |
| S24 States (d, m) | Updated, approve | Cannot play had two buttons (R39), now one action plus a reference line. Slow connection and offline match S118. |
| S25 End screen (d, m) | Updated, approve | 8 second countdown became 5 (L4-D4), autoplay default per R15. S117 holds the full set. |
| S26 Shortcuts (d) | Updated, approve | S and T rows added, header links 44 px, dialog sits above the player. |

## Findings

Severity: Blocker breaks accessibility or CLAUDE.md, Major is a missing state, a short target or a ruling miss, Minor and Note as in the skill. All Blocker and Major items are fixed in the mockups; the rows marked Open are for the build.

| # | Sev | Screen | Finding | Status |
|---|---|---|---|---|
| 1 | Blocker | S110, S111, S117 | Focus ring on the Skip button and the Up next tile is yellow only. Yellow on bright video is 1.06:1 on `#8FD3FF` and 1.24:1 on `#CFEBFF`, so a keyboard user loses focus on a light lesson. | Fixed: dark inner ring (11.8:1 to 15.5:1 on the picture) plus yellow ring (12.47:1 on the dark ring). Tile dismiss uses the blue ring, 4.73:1 on the pastel. Build: plan 11.2 item 3. |
| 2 | Major | all players | Seek rail `#3A3D46` is 1.77:1 on the player surface and 1.1 to 1.6:1 on the scrim over a bright frame (R34). | Fixed: `#6A6E78`, 3.75:1 on the surface, 3.14 to 3.23:1 on the real composite in every segment, yellow fill on it 3.32:1, thumb 5.1:1. |
| 3 | Major | all players | Buffered fill `#5B606B` would be darker than the lifted rail, so the bar would read backwards. | Fixed: `#9CA0AA`. The rail token is also used for menu borders and the ring track, which need a new `--color-player-border`. Open, build (plan 11.1). |
| 4 | Major | S114, S111 landscape, S116 | Time label (`#B4B8C2`) 4.19:1 and 3.78:1 against the lightest frame on the old scrim. Landscape title white on bare sky 1.52:1. | Fixed: scrim holds 0.9 above the rail (label 7.9:1 or better), top scrim for the title. |
| 5 | Major | S111 landscape | Skip button bottom 100 px sat 9 px inside the seek hit area (109 px). | Fixed: 117 px, 8 px clear. |
| 6 | Major | S116 | Kids profile sheet showed Autoplay next On. R15 says Off for kids. | Fixed, and a kids end card added to S117. |
| 7 | Major | S113, S115, S116 | Switch rows: a `role="switch"` nested inside a `role="menuitemcheckbox"` (desktop), no role at all on the phone sheet, 44 by 26 and 48 by 28 hit boxes (R30). | Fixed: the row is the control, 44 px tall, the track is `aria-hidden`. |
| 8 | Major | S114 | AirPlay drawn as shipping. R16 puts it behind a device spike. | Fixed: first bullet and tag say so. The button stays hidden until the spike passes. |
| 9 | Major | S116, S118 | Fixed 374 px toast overflowed a 360 px player by 22 px. | Fixed: `max-width: calc(100% - 16px)`. |
| 10 | Major | S119 | Missing: intro under 3 s and past the end errors (M43-S04 AC3), empty chapter list (M43-S06). | Fixed. |
| 11 | Major | S119 | M43-S13 AC1 and AC2 had no screen (Site settings countdown field and refusal). | Fixed: Playback group field, valid and refused, desktop and mobile. |
| 12 | Major | S115, S116, S118 | Missing failure cases: Autoplay save rollback (M43-S11), Data saver save failure (M43-S15). | Fixed. |
| 13 | Major | S114 | Desktop full screen top bar (Back and title, plan finding F12) was not drawn. | Fixed. |
| 14 | Major | S119 | Breadcrumb was plain text, brand link 28 px tall (R30, R32). | Fixed: shared pattern, links 44 px wide and tall, current crumb inline block with a 44 px line height and ellipsis, `aria-current`. The brand link comes from the shared S45 shell, so L3 should check the same link. |
| 15 | Major | S22 to S26 | Old boards disagreed with the set: 4 px rail with a 16 px thumb and 24 px scrim, Speed and Quality bar buttons, Cannot play with two buttons, 8 s countdown, autoplay "off by default", no S and T rows, 19 px header links. | Fixed, see What changed. |
| 16 | Minor | S114 | Theatre diagram card clipped the Up next row. | Fixed. |
| 17 | Minor | S118, S24 | Reference shown as `Reference 7K4QX2`. DESIGN-SYSTEM 11.21 says `Reference: AD-4F2A`. | Fixed. |
| 18 | Minor | S110 | Live region text "Skip intro available. Press S." against AC6 "Skip intro available". | Fixed, `aria-keyshortcuts` on desktop. |
| 19 | Minor | S112 to S118 | Menus sat 2 px inside the seek hit area. | Fixed, 112 px bottom. |
| 20 | Minor | S118, S24 | Focus was not drawn on the single action of an error overlay. | Fixed: focus moves to the action on open, ring drawn. |
| 21 | Minor | all | Off token hex values: `#1B1D24` menu surface, `#3A3D46` menu border, `#6E7179` switch off, `#D5D8E0` overlay text, `#3E424B` tile meta, `#12263A` heading (mapped to ink per DS 3.2). | Open, build: plan 11.1 adds the three player tokens, the rest map to `--color-player-muted`, `--color-ink`. |
| 22 | Minor | S115, S116 | Clear background with Edge None is allowed with only a warning, leaving white captions on a bare bright frame. | Open, build: auto switch Edge to Shadow and say so (plan 11.3, L4-D19). |
| 23 | Minor | S115 | "NEW" tags on the S and T rows of the shortcuts dialog read like product copy. | Note: annotation only, not shipped. |
| 24 | Note | DESIGN-SYSTEM | The doc still says the bar has Speed and Quality buttons, a 4 px rail, autoplay off by default and an 8 s countdown. | Open, L8: exact edits in plan 11.4. |
| 25 | Note | S26 | Rail 2.98:1 under the modal backdrop. Inactive content behind a dialog, exempt. | Note |
| 26 | Note | all mobile | Frames are drawn at 390. At 360 every frame was re-rendered and checked, no overflow after finding 9. | Note |
| 27 | Note | build | The control scrim must stay below the Skip button, tile, menus, toasts and captions (the shipping CSS must not paint the scrim over them). | Open, build: plan 11.2 item 2. |

## What changed

Mockups are regenerated and mirrored into `/home/claude/ad/project/`. S110 to S119 keep their names. S22 to S26 are copied into `docs/mockups/v2/L4/` with a note band at the top of each (Updated in the L4 review) so the whole player set is one consistent family. The original S22 to S26 stay in git history and in `/home/claude/ad/project` backups taken before the edit.

- Shared control bar: 5 px rail growing to 8 px, `#6A6E78` rail, `#9CA0AA` buffered, scrim that holds 0.9 to above the rail, top scrim for the title bar.
- Focus: two ring form on the picture, blue ring inside pastel tiles, ring on the single action of error overlays.
- Switch rows are the control (role, 44 px) on every menu and sheet.
- S22 to S26: new bar and Settings button, submenus with back arrow, one action errors with a separate reference line, 5 s countdown, R15 default, S and T shortcut rows, 44 px header and breadcrumb links, reduced motion notes.
- New states: kids end card and tile states (S117), Autoplay save rollback (S115, S116), Data saver save failure (S118), full screen top bar (S114), intro under 3 s, past the end and empty chapter list (S119), Site settings countdown field (S119).
- Plan: section 11 Amendments in `docs/plan/v2/L4-player.md` (tokens, player rules, story edits, DESIGN-SYSTEM edits, decisions L4-D16 to L4-D19).

## What remains for the build

1. Tokens: add `--color-player-border`, `--color-player-surface-raised`, `--color-player-switch-off`, change `--color-player-rail` and `--color-player-buffer`, and move the four `player.css` border uses off the rail token (lines 361, 417, 758, 815) in the same slice (L4-04). Add a token test that the rail is at least 3:1 on `--color-player-bg`.
2. Stacking order and caption position, plan 11.2 item 2. A Playwright test should read the Skip button text contrast with the scrim present, not only the button alone.
3. Two ring focus on picture controls, with a transparent outline for forced colours (R37 form).
4. Hover rules only in `@media (hover: hover) and (pointer: fine)` and reduced motion with `reduce` (R31). The mockups state it, the 11 hover rules in `player.css` are the work.
5. 44 px: Skip button (min height), tile dismiss, every menu row, switch rows, chapters rows, seek hit area, breadcrumb links on the editor (R30, R32).
6. R15 wiring: `autoplayNext` default true for non-kids, false for kids, fixture and player default aligned (finding F15), Data saver still forces Off.
7. R16: AirPlay button behind a setting, off until the spike passes on a real iPhone and Apple TV. Help line "Use Cast from the Chrome menu" is the only Cast surface.
8. The 360 width: the real player uses `aspect-ratio: 16 / 9`, toasts `max-width`, and the sheet never scrolls sideways.
9. Clear background with Edge None correction (L4-D19), `aria-keyshortcuts="S"` on desktop, live region text from M43-S01 AC6.
10. L8 edits to DESIGN-SYSTEM from plan 11.4. L3: the shared admin shell brand link (finding 14).

## Story AC the design cannot show

These need tests or a manual pass, not a mockup.

- M43-S01 AC2 to AC5: seek target, S key, focus move to Play, the 8 s idle timer, return on pointer or key, no return after skip. AC6 timing of the single announcement.
- M43-S02 AC3 and M43-S03 edge: a credits marker without an end, and an intro followed by a recap in one episode (sequence over time).
- M43-S04 AC2 to AC5: Use current time reads the player, Test starts 3 s early, save applies with no republish, copy fills fields for review.
- M43-S05 AC2 and AC5: tooltip follows the pointer and drag, `aria-valuetext` content with the chapter title.
- M43-S06 AC1 sorted insert, AC2 first chapter at 0:00 and AC3 spacing rules (the messages are drawn, the logic is not), the 50 chapter cap message, an empty title row message.
- M43-S07 AC3 remembered language, track switch keeping position.
- M43-S08 AC2 remembered theatre mode, leaving full screen restores layout.
- M43-S09 AC2 position kept through the switch, AC3 the 15 minute guest limit (depends on the L1 token TTL, R19), and the whole feature until the device spike passes.
- M43-S10 Chromecast: not built (R16), only the Help line.
- M43-S11 AC2 saving to the profile, guest choices stay on the device, S17 AC3 "Sign in to save" rows (none today).
- M43-S12 AC2 saving and `/settings/playback` match, AC3 the 4.5:1 check for High contrast over real frames.
- M43-S13 AC1 the end screen using the setting, S14 counting three unattended autoplays per tab, S15 AC2 two stalls in 60 s, S16 marker suggestions (a Could, not drawn).
- Plan finding F10 PiP on iOS Safari and F13 stall timers need a device pass (L4-12).

## Contrast figures used

Rail `#6A6E78` on `#0E0F13` 3.75:1. Played `#FFC93C` on the rail 3.32:1. Thumb `#FFFFFF` on the rail 5.1:1. Buffered `#9CA0AA` on the surface 7.32:1. Old rail on the surface 1.77:1. Time label `#B4B8C2` on the new scrim over the lightest frame 7.96:1 to 8.52:1, on the old scrim 4.19:1 (S114) and 3.78:1 (landscape). Skip button ink on white 17.03:1, ink on yellow 11.09:1. Yellow on a bright frame 1.06:1 to 1.24:1, dark ring on a bright frame 11.79:1 to 15.49:1, yellow on the dark ring 12.47:1. Blue ring on the pastel tile 4.73:1. Switch off track `#6E7179` on the menu surface 3.45:1 and on white 4.88:1, on track yellow on the menu 10.96:1. Reference text on the error overlay 6.45:1.
