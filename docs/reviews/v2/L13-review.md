# L13 design review: series with the owner's own names

Date: 25 November 2026. Reviewer: `angels-delight-design-system` skill. Inputs: `docs/plan/v2/RULINGS.md` (rulings win), `docs/DESIGN-SYSTEM.md`, `packages/ui/src/tokens.css`, and the real code the mockups must match: `apps/web/src/components/admin/SeriesEditor.tsx`, `apps/web/src/components/title/EpisodeList.tsx`, `apps/web/src/components/admin/VideosList.tsx` with the bulk bar, `packages/ui/src/components/Cards.tsx` (`nextLabel`) and `packages/shared/src/messages/l7-discovery-messages.ts` (`title.season`, `title.episode`, `title.upNext`).

Mockups live in `docs/mockups/v2/L13/`, desktop at 1360 and phone at 390 (the `_m` files). Numbers S188 to S192 were the next free ones on origin/main when this was written (L12 holds S182 to S185, L11 holds S186 and S187). Renumber on conflict.

How it was measured: every file was rendered in Chromium through Playwright at its own width. A script measured every button, link, radio, tab, switch, menu row, input and select (under 43.5 px in either direction counts as a fail), checked horizontal overflow, and grepped the sources for hex and rgb colours outside the inlined token file, `outline: none`, raw pixel font sizes, em and en dashes and emojis. Contrast was computed from the token values. Each file inlines `tokens.css`, so every colour, space, radius, shadow and font in a mockup is a `var(--token)`.

## Screens

| Screen | File | States shown |
|---|---|---|
| Viewer series page with owner labels | S188 | signed in, kids profile, guest, guest in Kids mode, many groups, group with nothing to show, no lessons, loading skeleton |
| Videos list, bulk bar, Add to series dialog | S189 | 4 selected, More menu, dialog for an existing series, new series, number already taken, saving, result with undo toast, after undo |
| Series editor with reorder | S190 | numbering problems, pointer drag, keyboard reorder, move to another part, rename and rename error, after fix and after move with undo, empty series, empty part, view only |
| Series names setting | S191 | preset chosen, preset focus, default preset, Custom typing, errors, warning, per series override on, saving and saved |
| Card and hover card with Next label | S192 | Continue learning row, label rules, hover card first and last card, keyboard focus, three presets, kids row, loading |

## Verdict per screen

| Screen | First pass | After fixes | Notes |
|---|---|---|---|
| S188 | Approve with minor fixes | Approve | Resume button icon sat above its text. Phone rows had uneven edges. The many groups board carried explanation text inside the page and lessons that did not match the group. |
| S189 | Changes required | Approve | Phone dock buttons were filled primary blue on the dark bar and Clear was a blue block. The dock had no Select all link. |
| S190 | Approve with minor fixes | Approve | On the phone the row menu button wrapped to a second line. Gap and duplicate rows had no word, only an edge colour. |
| S191 | Approve | Approve | Nothing failed the checks. Open notes below. |
| S192 | Approve with minor fixes | Approve | Next label example for a new group contradicted its subtitle, and the long code example contradicted its lesson number. |

Counts after fixes: 0 Blocker, 0 Major open, 0 Minor open, 6 Notes (build and decision points). Overall verdict: **Approve**.

## Findings

| # | Sev | Where | Finding | Status |
|---|---|---|---|---|
| F1 | Major | S189 phone | Dock "Add to series", "Publish" and Clear took the blue button fill because the dark bar rules were scoped to the desktop bar only. White on dark is the bar spec (S102, R38). | Fixed, dock has the same white and outline variants |
| F2 | Major | S189 phone | Dock had no "Select all N that match" link (R30 lists it as a 44 px target). | Fixed, link on its own 44 px row |
| F3 | Major | S190 | Gap and duplicate rows relied on an edge colour only. | Fixed, chips "Gap before" and "Same number" with icons, issue rows with icon, title and one action |
| F4 | Major | S190 phone | Move, Up, Down and More wrapped to two lines because of an indent. Four 44 px targets fit in 239 px, so the indent was dropped. | Fixed |
| F5 | Minor | S188 | Resume button icon stacked above the label. | Fixed, icon and two lines of text side by side, 56 px tall |
| F6 | Minor | S188 phone | Current lesson row had different side padding than the others so thumbnails did not line up. | Fixed, same padding for every row |
| F7 | Minor | S188 | Many groups board explained the 9 plus rule inside the page. That belongs in the board note. Its lessons were Genesis lessons under Book 4. | Fixed, real Chapter rows with C codes, note moved to the board label |
| F8 | Minor | S192 | Exodus card said Part 1 Lesson 8 next but the label said P2 L1. Prayer card said Lesson 3 next with a label of LES124. | Fixed, subtitles match labels |
| F10 | Major | S188 desktop | The two rail arrow buttons on the many groups board had malformed markup, so the accessible names read as a stray quote instead of Show earlier books and Show later books. Found after the first merge by a markup scan. | Fixed in a follow up |
| F9 | Minor | all | S numbers S182 to S187 were already taken on main by L11 and L12. | Fixed, renumbered S188 to S192 |

## Checks that passed (Pass on all ten files)

- Tokens only: no hex or rgb colour in any mockup CSS outside the inlined token file. Scrims use `rgba(var(--scrim-rgb), .6)`. Fonts only `var(--font-*)`. No `outline: none`. No raw pixel font sizes.
- Touch targets: 0 elements under 44 by 44 across 10 files (buttons, links, tabs, radios, switches, menu rows, inputs). Checkboxes and switches sit in a 44 px box.
- Focus: 3 px ring with 2 px offset (R37) shown on the Add to series button, a preset, a grip, a card thumbnail, an input and the new series title field. Forced colours fallback is in the shared CSS. Dark surfaces use `--color-focus-ring-dark`.
- One action per error (R39): numbering issues (one button each), number taken (Start at Lesson 9), rename clash (Use Abraham 2), names errors (Go to first problem), empty group (Show Part 1), empty series (Add videos).
- Status never by colour alone: Watched, In progress with minutes left, Gap before, Same number, Moves, Taken, Draft, Published all carry an icon or word.
- Skeletons: same geometry as the page, after 300 ms, static under reduced motion, container `aria-busy`, status text for screen readers.
- Contrast (computed): chip text 4.69 (success), 5.37 (warning), 5.75 (danger), 7.37 (info); Next chip ink on accent 11.09; white on primary 5.25; muted on bg 5.77, on sunken 5.24, on primary tint 5.49; sidebar muted on sidebar 7.98; accent on progress rail 7.06; control edge `--color-border-strong` 3.32 on white and 3.04 on bg; focus ring on bg 4.81 and on primary tint 4.57.
- Copy: sentence case, plain words, no em or en dashes, no emojis. Ranges are written as "Lessons 9 to 12".
- Hover card follows R10 and R31: 1.25 scale after 300 ms, only with hover and a fine pointer, origin left for the first card and right for the last, no hover card on touch, details also open from a More info button so keyboard users lose nothing.
- No sign up wall (R01): the guest page plays and resumes from this device. Kids rows have no sponsor or donate surface (R25). Kids guest copy is the R17 sentence and the phone has no sign in button.

## Notes (decision points for the build)

| # | Note |
|---|---|
| N1 | Numbering restarts inside each group (Part 2, Lesson 5), so the Next label needs a rule. Mockups use the item code inside a group (`Next: L6`) and group code plus item code when the next lesson starts a new group (`Next: P2 L1`). Log in `docs/DECISIONS.md` when built. Reversible. |
| N2 | Group rail: 2 to 8 groups show every group, 9 or more scroll with a fade and, on phones, a Jump to select. The real `EpisodeList` is a select today and shows a selector only above one season. The rail replaces it. Build with `role="tablist"` and arrow keys, and keep the `season` query parameter working (rename to `group`, accept both). |
| N3 | Real data and messages to change: `SeriesActions.setEpisode(videoId, seriesId, season, episode)` stays as is underneath, but copy moves out of `title.season`, `title.episode`, `title.upNext`, `title.episodeProgress`, `title.seasonEpisodes` into one names helper. Add `title.resume` ("Resume {item} {number}"). `EpisodeRow` and `SeasonRows` in `EpisodeList.tsx` keep their shape. |
| N4 | Bulk bar: add an `add_to_series` action next to the existing types in `VideosList.tsx`. Needs `video.edit`. Dialog is a client dialog that runs the existing per video command in chunks and records the previous series, group and number of each video so Undo can restore them. |
| N5 | Names are one site setting with an optional per series override (off by default). Custom words show as typed in every interface language, so catalogs stay untranslated for these two words (R23). Max 20 characters per word, short codes 1 to 3 letters, plural required. Default and fallback is Season and Episode. |
| N6 | Kids profiles hide groups whose lessons are all above the profile limit. The count line and the rail follow what the profile can see. No new rule, this is the existing maturity filter applied to groups. |
