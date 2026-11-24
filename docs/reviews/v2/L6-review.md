# L6 design review: Discovery, SEO, consent and search (S130 to S139)

Reviewer: angels-delight-design-system skill. Date: 24 November 2026. Branch `review/L6`. Rulings applied: R26, R30, R31, R39 (and R17 and R19 where the storage list touches them). Mockups fixed in place in `docs/mockups/v2/L6/` and copied to `/home/claude/ad/project/`.

Method: every board rendered with Playwright (Chrome) at 1360 for desktop boards and 390 and 360 for mobile boards. A script measured every link, button, input, switch and role=button element (44 px rule), computed text contrast from computed colours on solid backgrounds, checked horizontal overflow, and listed controls without an accessible name. Text on gradients was measured from pixels. Greps for em dash, en dash, emoji and `outline: none` were clean on all 20 files. Before numbers are in the findings, after numbers in the verdicts.

## Verdicts

| Screen | Verdict | Notes |
|---|---|---|
| S130 Search empty (desktop, mobile) | Approve with minor fixes (fixed) | Guest copy contradicted the storage list. Fixed. |
| S131 Search typing | Approve | Active option has the 3 px ring, options 48 px, clear 44 px, loading line, error line. |
| S132 Search results | Approve with minor fixes (fixed) | Partial failure count and Show more skeleton count fixed. Count wording settled. |
| S133 Search no results | Approve | One sentence, tips, did you mean, chips, popular row, kids variant, popular failure. |
| S134 Voice search | Approve with minor fixes (fixed) | Disclosure copy over promised. Fixed. |
| S135 Share menu | Approve with minor fixes (fixed) | Email removed from the default list (R26), series wording, toast rule. |
| S136 Link previews | Changes required, now fixed | Scrim let white text fall to about 2.9:1 on light posters. Fixed to 12.8:1 worst case. |
| S137 Admin Discovery | Changes required, now fixed | Switches 28 px high and unnamed (R30), no share options setting (R26), no Kids indexing line (R26). |
| S138 Storage notice | Changes required, now fixed | Notice overlapped the toast zone, inventory had wrong cookie name and unmarked guesses, missing keys. |
| S139 Error pages | Changes required, now fixed | Two or three actions on every error state (R39). One action each now. |

All ten verdicts are Approve after the fixes below. No blocker remains in the mockups. Blockers for the build are listed in "What remains".

## Placement decision: storage notice versus toast (settled)

Design system 11.13 puts toasts bottom left on desktop. The old notice was bottom centre, 640 px wide, which at 1360 starts at 360 px and meets a 360 px toast (24 px offset) by 24 px, and covers it entirely at 1024 px. Decision:

- 1024 px and wider: notice bottom right, 440 px wide, 24 px from the edges. Toast bottom left, up to 360 px. Gap at 1024 px is 176 px, so they never meet.
- 600 to 1023 px: notice spans the width (24 px gutters), one row. The toast lifts above it by notice height plus 12 px, through a `--notice-h` custom property the notice sets (0 when hidden).
- Phones: notice above the tab bar (tab bar 56 px plus 8 px), toast lifts above the notice by the same rule.
- Layer: notice on the overlay layer (z 30), below modal 40 and toast 50. The old mockup used 40, level with modals.
- Hidden on every watch page, never takes focus, never traps it.

Shown in S138 state 1 and 2 (right), state 7 (toast and notice together at 1360 and at 900 wide), and the mobile state 7. Recorded in `docs/DESIGN-SYSTEM.md` 11.13.

## Findings

Severity follows the skill: Blocker breaks CLAUDE.md or accessibility, Major is a missing state, small target, wrong spec or ruling breach, Minor, Note.

| # | Sev | Screen | Finding | Measured or seen | Status |
|---|---|---|---|---|---|
| 1 | Major | S139 | R39: 404 had Back to Home and Browse subjects; removed video had two; server error had Try again, Back to Home and Report this; offline had Try again and Open Home | 2, 2, 3, 2 actions | Fixed: one action per state (Back to Home, Back to Home, Try again, Try again). Header keeps Home and Browse. |
| 2 | Major | S138 | Notice at 640 px bottom centre overlaps bottom left toast | 24 px overlap at 1360, full at 1024 | Fixed, see placement decision |
| 3 | Major | S138 | Storage list had `ad_guest`; R19 names the cookie `__Host-ad_guest` | | Fixed |
| 4 | Major | S138 | Durations and key names presented as fact with no source | `__Host-ad_session` "Until you sign out", `ad_profile`, guest cookie "180 days", display choices, offline cache, player choices | Fixed: unverified values carry a "Confirm at build" badge (see list below) |
| 5 | Major | S138 | Storage list missed keys that R17 and R19 create: guest Kids mode choice, import answer, 100 entry progress cap, player choices | | Fixed: rows added |
| 6 | Major | S137 | Switch hit area 48 by 28 (R30), three switches | 28 px | Fixed: 48 by 44, track drawn by pseudo element, `tabindex=0` |
| 7 | Major | S137 | Switches had no accessible name | 3 unnamed | Fixed: `aria-label` on each |
| 8 | Major | S137 | R26: share list "WhatsApp, Facebook, X, copy link, configurable" had no admin control | | Fixed: Share options card, Email off by default, Copy link always on |
| 9 | Major | S135 | Menu listed Email, not in the R26 list | | Fixed: Email removed from default list, configurable in admin |
| 10 | Major | S136 | Social image scrim 0 to 0.85 linear. In the title zone (65 to 78 percent of height) alpha is about 0.5 to 0.64, so white text on a light poster falls to about 2.9:1 at the 90th percentile | 2.9:1 | Fixed: stops 0 at 0, 0.62 at 38, 0.85 at 58 and 100 percent. Title zone is at least 0.85, worst case white poster gives 12.8:1. Pixel check: median 11.4 to 13.1:1 |
| 11 | Minor | S132 | Partial failure count "9 results" is wrong when series failed to load | | Fixed: "9 videos for 'farming'" |
| 12 | Minor | S132 | Show more skeleton drew 5 tiles with 2 results left, so geometry did not match the final | 5 versus 2 | Fixed: 2 tiles |
| 13 | Minor | S130 | Guest line "Searches are not saved" contradicts the inventory (`ad-recent-searches` is stored on device for everyone except Kids) | | Fixed: "Recent searches stay on this device only." |
| 14 | Minor | S134 | "We do not keep it" promises what the browser vendor does | | Fixed: "We do not store what you say." |
| 15 | Minor | S135 | Menu title "Share this video" on a Series page | | Fixed: "Share this series" (build: by type) |
| 16 | Minor | S137 | No line saying Kids only titles are never listed (R26) | | Fixed: line under the indexing switch |
| 17 | Minor | all | Skeleton shimmer wrapped in `no-preference` instead of the standard `reduce` form (R31) | 20 files | Fixed: shimmer by default, `@media (prefers-reduced-motion: reduce)` turns it static |
| 18 | Minor | S138 | Notice z-index 40, same layer as modals | | Fixed: 30 |
| 19 | Note | all | Mockup CSS hardcodes a few hex values (badge inks, banner borders, toast ink, social image) | | Mockup only. Build must map each to a token; badge and banner inks already exist as `--color-*-ink` or need adding (see build list). |
| 20 | Note | S130 to S134 | Search field shows the focus ring in states that are not keyboard focus, to mark the active field | | Accept in mockup. Build uses `:focus-visible` only. |
| 21 | Note | S133 | Kids popular row repeats general titles (Money, Maths) | | Mockup content only. Build filters by audience (already in plan S7). |
| 22 | Note | S131, S133 | Nav shows Home as active on search pages | | Build: no active item on search, or Browse. |
| 23 | Note | S139 | Heading focus ring shows in state 1 and others | | Correct for keyboard arrival, build uses `tabindex=-1` and `:focus-visible` so mouse and tap show nothing |
| 24 | Note | S135 | Facebook and X rows use generic icons | | Build uses brand glyphs from the icon set if licensed, else keep the word. The word is always visible. |

Measured results, before then after:

- 44 px targets: before 3 failures (S137 switches), after 0 across all 20 boards at 1360, 390 and 360. Inline text links excluded (none under 44 as blocks).
- Contrast: before and after, 0 failures on solid backgrounds in every board. The 8 (S136) and 4 (S137) script reports are white text on image or gradient art and were measured from pixels instead (finding 10). S137 social image text is white on the blue default image (#1F6FB5, 5.4:1).
- Unnamed controls: before 3, after 0.
- Horizontal overflow: 0 at 1360 and 390. At 360 each mobile board reports 30 px, which is the fixed 390 px board canvas, not the content. Content uses `min-width: 0` and wrapping, and no control is clipped in the 360 renders. The build must still be tested at 360 (see below).
- Em dash, en dash, emoji, `outline: none`: none in any file.

## Storage durations list: what is verified and what is a placeholder

Source for verified items: RULINGS R17, R19, R26 and the L6 plan. "Confirm at build" items carry the warning badge in S138 and must be replaced by the real value in `STORAGE_INVENTORY` (the privacy page and the test read the same list). The badge itself is a design marker and does not ship.

| Item | Shown | Status |
|---|---|---|
| `__Host-ad_session` | Until you sign out | Placeholder. Real value is the session TTL in the auth package. |
| `ad_profile` | Until you switch profile | Placeholder. Cookie lifetime not yet fixed. |
| `__Host-ad_guest` | 180 days | Name verified (R19). 180 days is the L6 plan guess; R19 gives no cookie lifetime (15 to 20 minutes is the segment URL, a different thing). |
| `ad:guest:progress:v1` | Until you clear it, last 100 videos | Verified (R19 key and 100 entry cap). |
| Kids mode choice | Until you clear it | Key name and lifetime to confirm (L1). |
| Import answer | Until you clear it | Key name and lifetime to confirm (L1). |
| `ad-recent-searches` | Last 5, until you clear it, not on Kids profiles | Verified from code (plan facts) and M06-S07. |
| Player choices | Until you clear it | Placeholder, keys owned by L4. |
| Data saver and theme | Until you clear it | Placeholder, keys owned by the design lane. |
| Offline pages cache | Until the site updates | Placeholder, cache name owned by the service worker. |
| `ad:notice:v1` | 12 months | Verified (M45-S11 AC2). |
| `ad:voice:ok` | Until you clear it | Key verified (plan S8), lifetime is localStorage default. |

R17 also requires clearing history to name everything it removes: the import answer and the Kids mode choice must appear in that list, which is why they are now rows here.

## Story AC visibility check

Visible in a mockup: M45-S03 AC1 and AC2 (S136), S05 AC1 to AC3 and Empty (S137: counter, preview, 171 of 160 block), S06 AC1 to AC4 and Edge and Error (S135), S07 and S08 typo and did you mean (S131, S133), S09 AC1 and AC3 and Empty (S133, S137), S10 AC1 to AC3 and Error (S134), S11 AC1, AC2 (as copy), AC4, Edge and Empty (S138), S14 AC1 to AC3 and AC4 root error (S139). M45 UI findings 1, 3, 4, 5, 6, 8, 10, 11, 12, 13, 14, 15, 16, 17 all visible. Finding 9 (polite live region) is a behaviour, the toast is drawn with `role="status"`.

Story text that now disagrees with the design and must be edited in `docs/USER-STORIES.md` when M45 is added:

- M45-S14 AC1 says the 404 "offers Search, Home, Browse and popular titles". Under R39 it has one action (Back to Home) plus a search field and popular titles; Browse is the header link. Reword AC1.
- M45-S14 AC3 says Try again, Home, a Reference id and a Report link that prefills the reference. Under R39: Try again, plus the reference and the support email as plain text. A mailto prefill would be a second action. Reword AC3 (decision for the owner: if a Report link is wanted, it must replace Try again, which is worse).
- M45-S06 AC2 says Copy link and WhatsApp first, then Facebook, X and Email. R26 lists no Email. Reword: "then Facebook and X, plus any channel the admin enabled".
- M45-S11 AC3 "lists every cookie and storage key with purpose and duration": keep, but add that the list includes the guest Kids mode choice and import answer (R17).

## What changed

- S138: notice moved bottom right with its own layout (text, then link and Got it on one row), layer 30, new state 7 (toast and notice together at 1360 and 900, mobile too), storage list rewritten with the corrected cookie name, new rows and Confirm at build badges, states renumbered 1 to 8.
- S139: one action per error state, support email and reference as plain text, bands reworded.
- S137: switches 44 px high with names, Share options card, Kids indexing line, frame heights raised.
- S135: Email removed from the default menu, series wording, toast rule noted.
- S136: four stop scrim.
- S132: count wording on partial failure, two skeleton tiles.
- S130, S134: copy fixes.
- All files: skeleton shimmer uses the `reduce` form; page heights in `$preview` updated.
- `docs/DESIGN-SYSTEM.md` 11.13: notice and toast rule added.

## What remains for the build

Build blockers (must hold before merge of the matching slice):

1. `STORAGE_INVENTORY` must hold real values for every Confirm at build row. The inventory test must fail while any entry is marked unverified.
2. The notice component must set `--notice-h` and the toast container must read it. Add a test: with the notice visible at 1024, 800 and 390 px wide, notice and toast rectangles do not intersect.
3. Switches in admin must keep the 44 px hit area (`min-height: 44px` on the control, not the track).
4. Error pages: one action each, enforced by a test that counts links and buttons in the main region (R39). `global-error` keeps the single Reload button.
5. Social image generator must use the four stop scrim and a test must sample a white poster and assert at least 4.5:1 in the title zone (R36 style).
6. Kids only titles: `noindex`, absent from the sitemap, absent from search engine facing metadata (R26). Share hidden for Kids.

Build checks the static mockups cannot prove:

- Contrast must be re-measured with the real theme tokens and with the lemon and large size theme test from the skill.
- Hover rules inside `@media (hover: hover) and (pointer: fine)` (R31). The mockups have no hover states, so the build adds them there only.
- Focus visibility with forced colours (R37 outline plus transparent outline) on search options, chips, tiles, switches and the notice button.
- 360 px with 200 percent zoom on S130, S132, S135 popover (bottom sheet below 600 px), S138 and S139.
- Notice button should be a `button`, not a link (mockup uses anchors for all actions).
- Skeletons appear after 300 ms and `aria-busy` on containers; the mockups draw them statically.

## Story AC the design cannot show

- M45-S01, S02, S04, S12, S13: robots, sitemap, JSON-LD, canonical and hreflang, analytics posture and performance budget are not visual. Tested by the scoped tests in the plan.
- M45-S03 Edge and Error: 300 KB image size and fallback on generation failure (S136 shows only the 212 KB label).
- M45-S05 AC2 (new values live within 5 minutes) and Error (save failure keeps text).
- M45-S06 AC1 (native share sheet), Edge (cancelling shows nothing, AbortError ignored), all external links opening in a new tab with screen reader text (S135 draws the icon, the text is in markup only).
- M45-S07 and S08: correction thresholds, synonym expansion cap of 8, ranking.
- M45-S09 AC2, AC3: guest search works without sign in (the mockup shows the guest header only), misses stored without identifiers and deleted at 90 days, miss logging failure never affects the response.
- M45-S10: first use remembered after Continue, Escape stops listening, 600 ms submit delay, reduced motion ring (drawn, behaviour not).
- M45-S11 AC2: returns after the admin bumps the version or 12 months; storage blocked behaviour (drawn as a state, logic is code); no layout shift (fixed position, tested with CLS).
- M45-S14 AC2: HTTP 404 status and `noindex` on every error page; focus moves to the heading on mount.

## Summary

Counts: Blocker 0, Major 10 found and fixed, Minor 8 found and fixed, Note 6. Verdict: Approve all ten screens after the fixes in this pull request. Not applicable checks: new tokens (none added; `--notice-h` is a runtime custom property, document it in section 3), OTP and password forms, tables other than the storage list, upload dropzone, player controls.
