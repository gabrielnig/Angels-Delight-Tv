# L14 UI review: admin Help centre and knowledge base (S193 to S199)

Reviewer: `angels-delight-design-system` checklist. Date: 25 November 2026. Inputs: `docs/plan/v2/RULINGS.md` (R30, R31, R32, R37, R38, R39 apply), `docs/DESIGN-SYSTEM.md` sections 3, 4, 6, 9, 11.2, 11.10, 11.12, 11.14, 11.20 to 11.25, 14, the real admin shell (`apps/web/src/components/admin/AdminShell.tsx`, `nav.ts`) and the 14 files in `docs/mockups/v2/L14/`.

Method: every file was rendered with Playwright at 1360 (desktop) and 390 and 360 (mobile) using `docs/reviews/v2/tools/l9-audit.mjs`. It measures every link, button and control (under 44 px), the contrast of every text node from computed colours (WCAG, large text 3:1), fonts under 12 px, dashes and emoji. Component CSS uses `var(--token)` only, the full `tokens.css` is embedded, no component hex.

## Screens

| Screen | Files | Contents |
|---|---|---|
| S193 Help centre home | d, m | Search, Start here path card, 6 learning paths with progress, popular, recently updated, progress card, role note, contact strip. States: first visit, Editor role, menu open (m). |
| S194 Article | d, m | Title, who it is for, read time, video with captions and transcript toggle, numbered steps with annotated screenshots, Tip and Careful callouts, Go to this screen (deep link), Mark as done, one tap helpfulness, related, previous and next, table of contents rail (d) and collapsible (m), print layout, sticky action bar (m). |
| S195 How-to videos | d, m | Watch page, 24 video playlist in 6 groups, chapters, speed and caption size menu, captions, Mark as watched, Up next with no autoplay, end card, safe area guide for recording. |
| S196 Search | d, m | Highlights, type filter, empty (typo and no match), focused with recents, loading, error. |
| S197 Contextual help | d, m | Help button, side panel (d) and bottom sheet (m) for the current screen, no guide, loading, offline, inline hint pattern on a form. |
| S198 States | d, m | Loading (home, article), slow, offline (saved and not saved), server error, not found, video error, progress save toast. |
| S199 Glossary | d, m | A to Z jump, filter, 16 terms with links to guides, filtered and empty states. |

## Findings

| # | Sev | Screen | Finding | Status |
|---|---|---|---|---|
| 1 | Major | all d | First draft pinned 20 sidebar items, so Help sat off screen. | Fixed: Help centre is pinned under the scrolling nav and in the mobile drawer, plus a Help button in the header (44 px). |
| 2 | Major | S194 | Annotation boxes were placed by percentages and missed their targets, and the Zoom button covered the target. | Fixed: the outline and the number sit on the real target element, Zoom moved into the caption row (44 px). Meaning is also in the caption text, never only in the image. |
| 3 | Major | S193 | The search row and chips overflowed 1360 by 27 px. | Fixed. |
| 4 | Major | S198 | The offline frame overflowed 1360 by 32 px (a shell nested in a padded state frame). | Fixed. |
| 5 | Minor | S197 | Heading showed a focus ring in the resting panel. | Fixed: ring only appears when focus moves there. |
| 6 | Decision | all | Header search ("Search videos") is hidden on Help pages so two search boxes never compete. Help has its own search. | Logged below. |
| 7 | Decision | S193 | Role aware: guides for a higher role are hidden with a count and a Show them action, not silently missing. | Logged below. |
| 8 | Note | S194, S195 | Video frames and screenshots show illustrative UI text under 12 px (9 to 10 px at phone width). In the build these are images and recorded video. The recording spec (S195 guide) requires 150 percent browser zoom and a crop on the action, and the phone guidance is Fullscreen sideways. Written steps carry the same content. | Note |
| 9 | Note | S193 | Micro labels (sidebar group names, State tags) are 11 px, the `--text-micro` token. They carry no essential information. | Note |
| 10 | Note | build | Chips, switches, search fields, the transcript and the glossary filter are drawn from divs and spans. Build uses native `button`, `input type="search"`, `details`, `role="switch"`. | Build |
| 11 | Note | build | Skeleton after 300 ms, aria-busy, no layout shift, focus to heading on error cannot be shown on a still. | Build |

## Rules checked

- 44 px targets (R30): 0 under 44 px across 14 files at 1360 and 390 (breadcrumb per R32, sidebar, Help button, hint buttons, chips, transcript rows, chapter rows, zoom, A to Z).
- Contrast: 0 text pairs under AA. Captions are white on a dark box at 82 percent alpha, over any recording this is 11:1 or better. Highlight uses `--color-accent` with `--color-on-accent` and bold, never colour alone. Status chips carry icon and word.
- Focus (R37): 3 px outline, 2 px offset, `--color-focus-ring`, dark surfaces and the player use `--color-focus-ring-dark`. No `outline: none` anywhere.
- Errors (R39): server error, not found, offline, video error and search error each show one action. A reference code is small text. Success after one tap helpfulness has no second required step.
- Copy: no dashes, no emoji, sentence case, verb first buttons, "You are offline", "Something went wrong on our side. Try again in a moment." as in section 14.
- Motion: only the skeleton shimmer, stopped by `prefers-reduced-motion`. Hover only inside `(hover: hover) and (pointer: fine)` (R31). No autoplay, Up next never starts by itself, help videos load on Play.
- Captions: live text track (not burned in), default size Large (22 px desktop, 18 px phone), safe area 5 percent, caption zone above the control bar, 12 words or fewer per cue and at least 2 seconds on screen. Transcript is a plain list of buttons that jump the video.
- Role aware: the nav and Help centre are visible to every admin role. Content is filtered by `can()`.
- Client input: support contact is `data-client-input` and a setting. Platform name stays configurable.

Not applicable: Google button, OTP, TV mode.

## Settled decisions to log in `docs/DECISIONS.md` when built

1. Help centre entry points: pinned sidebar link, header Help button, deep links from every admin screen (route to article map, one row per admin route).
2. Header search hidden on `/admin/help*`.
3. Hidden higher role guides counted with a Show them action.
4. No autoplay next in help videos, end card has one action.
5. Progress saved per account, mark as done is manual, watched is marked at 90 percent or by button.
6. Feedback is one tap (Yes or No), a note is optional.
7. Print uses the browser print dialog and a print stylesheet.

## Verdict

0 Blocker, 4 Major (all fixed), 1 Minor (fixed), 2 Decisions, 4 Notes. Approve.
