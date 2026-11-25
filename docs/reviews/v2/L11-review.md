# L11 UI review: Browse and Home hero sound (S182, S183)

Reviewer: `angels-delight-design-system` checklist. Date: 25 November 2026. Inputs: `RULINGS.md` (R10, R11, R12, R13, R30, R31, R37, R39), DESIGN-SYSTEM 6, 8, 11.5 to 11.7, 11.11, 11.14, 11.20, the real `BrowseView`, `browse-filters.ts`, `CardGrid`, `HomeHero` and `Hero`, and the fixture categories and titles.

How it was measured: `docs/reviews/v2/tools/l11-audit.py` renders all four files (1360 and 390, forced 360 for overflow) and prints dashes, emojis, raw colours, targets under 44 px, spacing, token contrast pairs and, for the hero, the contrast of white text on the real art with the text hidden. Poster art is dark cinematic gradients with a pale subject (lightest pixel F1EBDC assumed as worst case). Mockups use `var(--token)` only. The art SVGs are imagery and are the only hex values.

## Verdict per screen

| Screen | Verdict | Note |
|---|---|---|
| S182 Browse page, desktop | Approve with minor fixes | 12 states. Open: length labels (finding 1). |
| S182 Browse page, mobile | Approve with minor fixes | 10 states, same finding. |
| S183 Home hero with sound, desktop | Approve with minor fixes | 8 states. Needs D-358 doc edits and 4 tokens. |
| S183 Home hero with sound, mobile | Approve with minor fixes | 7 states. |

## Findings

| # | Sev | Screen | Finding | Status |
|---|---|---|---|---|
| 1 | Major | S182 | `BrowseView` labels say Under 5 min, 5 to 15 min, Over 15 min, but the service buckets (`DURATION_BUCKETS`, fixture) are under 3 min, 3 to 5 min, 5 min and over. The filter does not do what its label says. Mockup shows the real buckets. | Open, build: change the labels to match the data (or the buckets, owner choice) |
| 2 | Major | S183 | DESIGN-SYSTEM 11.7 says the clip has no audio track and runs 6 s. A sound button needs audio and a clip as long as the slide. | Logged D-358, doc edit in build |
| 3 | Major | S183 | White alpha values for track, border and hover were raw colours. | Fixed: four proposed Fixed tokens in the mockup `:root` (`--color-hero-track`, `-track-done`, `-border`, `-chip-hover`), to join tokens.css and section 3 |
| 4 | Major | S182 | First draft left a focused chip under the edge fade. | Fixed: `scroll-padding-inline` 72 px equals the fade width |
| 5 | Major | S183 | Sound slot appearing between Pause and the arrows would move Pause. | Fixed: Unmute sits left of Pause, slot reserved, nothing moves |
| 6 | Major | S183 | Segments were touching hit areas (0 px gap). | Fixed: 8 px margin, audit shows no neighbours under 8 px |
| 7 | Minor | S182 | Error state for Show more had the button saying Show more beside an error. | Fixed: one action, Try again (R39) |
| 8 | Minor | S182 | Loading state tinted the set Length button but greyed Sort. | Fixed: both grey while loading |
| 9 | Minor | S182 | Theme test did not scale text, custom properties resolve at `:root`. | Fixed: theme frames restate the scaled text tokens |
| 10 | Minor | S182 | Hover card showed one description for every title. | Fixed: real fixture blurbs |
| 11 | Minor | S183 | Accent fill on the pale track is 2.47:1. The fill is 8.6:1 against the scrim and the track is 3.5:1, so the progress is readable, but fill against track is under 3:1. | Accepted, the track is the remainder and the fill is the information. Raise if the owner wants a hard pass |
| 12 | Note | S182 | `RULINGS` R36 gives mobile scrim stops 50, 65, 80. tokens.css has 72, 82, 96 with mid 0.7. S183 uses tokens.css. | Open: doc and token disagree, pick one |
| 13 | Note | S182 | 11.11 says one Filters button with Apply on phones. S182 differs, see D-357. | Logged |
| 14 | Note | S182 | Rail arrows are real buttons in tab order, so keyboard users can skip them with Tab or use the chips. A "skip categories" link is not needed at 11 chips. | Note |

## Checklist result

- Tokens and theming: Pass. Theme test with dark ink on lemon and scale 1.15 (S182 state 12, mobile state 10): ink 15.99, muted 7.61, white on primary 8.73, info ink on tint 9.87, link 8.20, strong border 4.99.
- Contrast (default theme): ink on bg 15.59, muted on bg 5.77, white on primary 5.25, link 4.81, strong border on bg 3.04 (just over 3), focus ring 4.81, dark ring 12.47. Duration badge 8.44 over the palest poster. Hero text on the real art: title 18.75 desktop, 13.18 mobile, every text box above 5.25 (button face is white on primary).
- States: default, hover (inside the hover media query), focus, active selected, loading, empty, error all drawn for Browse. Hero: playing, sound on, paused, no clip, reduced motion and Data saver, focus, hover.
- Keyboard and focus: ring 3 px, 2 px offset (R37) on chips, menu buttons, cards, My List, hero controls (accent ring on dark). Menus follow the menu pattern, sheets trap focus.
- Targets: audit shows 0 controls under 44 px in all four files and no neighbours under 8 px.
- Motion: only transform and opacity animate. Progress fill is `scaleX`. Shimmer is static under reduced motion. Hover card has no scale under reduced motion.
- Mobile and data: checked at 390 and 360, no horizontal overflow outside the intended scrollers. No clip under Data saver. Hover card never on touch.
- Copy: no dashes, no emojis (audit). Empty state follows 11.20 and R39, one action each. Sentence case, short.
- Not applicable: tables, uploads, admin.
