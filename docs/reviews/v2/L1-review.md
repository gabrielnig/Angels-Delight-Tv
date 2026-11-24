# L1 Guest access: design review (24 November 2026)

Reviewer: UI reviewer, lane L1. Scope: mockups S80 to S89 (desktop and `_m`), reviewed against `docs/plan/v2/RULINGS.md` (rulings win), `docs/plan/v2/L1-guest-access.md` (UI review section 4 and stories M40-S01 to S18), `docs/DESIGN-SYSTEM.md`, the Netflix audit and the `angels-delight-design-system` checklist.

Mockups edited in place in `docs/mockups/v2/L1/` and copied to `/home/claude/ad/project/`. The generator scripts in `/home/claude/ad/gen/` (`g_l1a.py` to `g_l1d.py`, `l1lib.py`) were not changed, so regenerating the boards would undo these fixes. Treat the HTML as the source from now on.

## How it was measured

Playwright (Chromium), boards rendered at 1360 for desktop and at 360 and 390 for mobile (the mobile artboard root was forced to 360 and 390 wide, the boards are drawn at 390).

- Contrast: computed relative luminance per text node. Solid backgrounds by walking ancestors. Text over gradients or art: page screenshot with text hidden, worst pixel under the central text area. AA 4.5 for text, 3 for large text and UI.
- Targets: bounding box of every `a`, `button`, `.btn`, `.pill`, `input`, role button, switch, tab. Pass is 44 by 44 or more.
- Overflow at 360: any element past the artboard edge outside a scroll container, and clipped text.
- Greps: no em dash, en dash or emoji in any board (0 hits). Hex colours are static mockup values, they map to tokens as listed in `docs/DESIGN-SYSTEM.md` section 3 and must be tokens in code.

Result after fixes, all 20 boards at 360, 390 and 1360: 0 text contrast failures, 0 overflow at 360, 0 interactive targets under 44 px. The only boxes under 44 px are the decorative 52 by 30 switch tracks, which are `aria-hidden` inside a `role="switch"` row that is 56 px high (the row is the target).

## Verdicts

| Screen | Verdict | Main reason |
|---|---|---|
| S80 Home for guests | Changes required, then fixed | Hero header unreadable over sky art, hero not to ruling R12 and R36, rows not 2.3 and 5.3 columns (R11), row title not "Continue learning" (R14), 360 header collision |
| S81 Header and menu | Changes required, then fixed | Header Sign in 1.0 to 2.0 over hero art, nav links 42.7 px wide (R30), 360 header overflow and Kids badge pushing Menu off screen |
| S82 Title and series | Changes required, then fixed | Not found state had two actions (R39), rows not 2.3 (R11), 360 header |
| S83 Sign in to save | Approved with notes | Dialog and sheet match plan 4.5. Only the 360 header and the row sizes behind the scrim changed |
| S84 My List explainer | Approved with notes | Copy matches R17 exactly. Only the 360 header changed |
| S85 Guest watch | Changes required, then fixed | Seek rail 1.7 to 1 against the player (R34) |
| S86 Guest Kids mode | Changes required, then fixed | Switch said "Show all videos" when the site default is Kids (R17 says "Kids mode" everywhere), phone Kids cards not 2.3 (R11), 360 header |
| S87 Limit and challenge | Approved with notes | No change needed. Notes below |
| S88 Import device history | Changes required, then fixed | Error banner had two actions (R39), Kids header overflowed at 360, rows (R11), nav width |
| S89 Device storage and privacy | Changes required, then fixed | Notice said it shows when a video plays (R26: never on watch pages), clear history copy did not name everything removed (R17), seek rail |

## Findings

Severity follows the skill: Blocker, Major, Minor, Note. All Blocker and Major items below are fixed in the mockups.

| # | Sev | Screens | Finding | Ruling or rule | Fixed by |
|---|---|---|---|---|---|
| 1 | Blocker | S80, S81 desktop | Header controls sit over pale sky art. "Sign in" measured 1.0 to 2.0 (needs 4.5), search and menu icons on a 20 percent white fill. | DS 4, R36 | Header controls backed by `rgba(14,15,19,.6)` with a 1 px white border (white on sky blended, 5.8 to 1). Top scrim now .7 held to 14 percent, clear at 32 percent |
| 2 | Major | S80 | Hero scrim ended at 72 percent and dropped to .7 at 38. | R36 | `linear-gradient(90deg, .85 0, .85 40%, .4 60%, 0 100%)`. Title zone alpha is .85, above the .57 floor |
| 3 | Major | S80 | More info was a solid white button. No Pause, dots or arrows. | R12 | More info is translucent with a white border. Dots (44 px hit areas), Pause pill and arrows added on desktop. Phone gets dots and a 44 px Pause. Data saver state shows no controls because the hero does not rotate |
| 4 | Major | S80, S82, S83, S86, S88, S89 | Rows were 224 px (5.57 columns) on desktop and 220 or 260 px (1.5 and 1.3 columns) on phones. | R11 | Desktop `calc((100% - 60px) / 5.3)` with 12 px gap. Phone `calc((100% - 16px) / 2.3)` with 8 px gap, rail bleeds to the right edge. Kids phone rows also 2.3 |
| 5 | Major | S80, S88, S89 | Row titled "Continue Watching". | R14 | "Continue learning" everywhere including toasts and the privacy and confirm copy |
| 6 | Major | All `_m` at 360 | Top bar overflowed: wordmark touching the search button, Kids badge pushing Menu 18 px off screen, S88 Exit Kids mode 6 px off. | DS 13 mobile first, 360 check | Wordmark 15 px, Sign in padding 12 px. In Kids headers the wordmark is hidden, the logo link keeps an `aria-label` and a 44 px target |
| 7 | Major | S81 to S89 desktop | "Home" nav link 42.7 px wide. | R30, R32 | `min-width: 44px` on nav links |
| 8 | Major | S85, S87, S89 | Seek rail `#3A3D46` on `#0E0F13` is 1.7 to 1. Buffered `#5B606B` too close to the rail. | R34 | Rail `#6A6E78` (3.7 to 1). Buffered `#A3A7B0`. Hit area was already 44 px |
| 9 | Major | S86 | When the site default is Kids the switch read "Show all videos". | R17 | Label is "Kids mode" in every state with the help line "Shows videos made for children. Anyone using this device can turn it off." Default state reads On, an opt out reads Off |
| 10 | Major | S89 | Cookie notice "shown the first time a video plays". | R26, R19 | Shown once on the first page opened, never on a watch page, no Accept or Reject, text configurable. Names `__Host-ad_guest` as set when a video plays, and the Kids mode cookie only if used |
| 11 | Major | S89 | Clear history body: "removes your places and Continue Watching". | R17 | "This removes your places, Continue learning, your answer about adding history to an account, and your Kids mode choice on this device. This cannot be undone." |
| 12 | Major | S82 | Not found had Go to Home and Browse videos. | R39 | One action: Browse videos |
| 13 | Major | S88 | Import error had Retry and No thanks. | R39 | Retry is the one action. A 44 px close button dismisses and asks again next visit |
| 14 | Minor | S80 | Loading skeleton rows are 5 columns of the old width, not 5.3 and 2.3. | DS 11.14 | Not changed. Build note below |
| 15 | Note | S81, S86, S89 | `.sw` boxes are 52 by 30. | R30 | No change, the 56 px `role="switch"` row is the target. Build note below |
| 16 | Note | S87 | Check failed and challenge dialogs have Try again and Not now. | R39 | Kept. Not now is the dialog dismiss, the error is inline in the dialog, not an error page |
| 17 | Note | S80 | Gutter is 48 px, the token is `clamp(1rem, 4vw, 3.5rem)` (54 px at 1360, 16 px at 360). | R11 | Build uses the token, the boards keep 48 and 16 |

## Plan UI review (section 4) and story AC coverage

Visible in the designs and checked: signed out header with Main and Primary landmarks (4.1), no sign up banner or popup on Home, Title or Watch (4.2), Play goes straight to watch, line reserved so Resume never shifts layout, Kids block text "This video is not in Kids mode" (4.3, M40-S05), watch actions use an icon not a typed plus (4.4), Save dialog and bottom sheet with focus on heading, Not now, Like wording, Create account hidden when sign up is closed, navigating state (4.5, M40-S07), explainer with one primary action and the Kids copy of R17 (4.6, M40-S08), Kids switch is a switch with On or Off text and a badge, help line says "Anyone using this device can turn it off", no password flow (4.7, M40-S09), inline import banner with count, adding, success, partial, error, hidden for Kids profile (4.8, M40-S13), limit wait with countdown, challenge, failed check, Kids wait without widget, shared network note (M40-S11, S12), storage blocked note, notice, clear history confirm, privacy excerpt (M40-S04, S16, S18). Phone watch page has no Sign in button for guests (R17), shown in S85 default.

Story AC the designs cannot show (cover in tests and build):

- M40-S02 AC2, AC3 and M40-S03 (guest token, 30 minute lifetime, refresh, cookie flags, forged cookie, cookie set only in the session route, R19).
- M40-S04 AC3 and AC4 (100 entry LRU cap, corrupt store treated as empty), M40-S05 AC3 (Open Graph tags), M40-S17 (robots, noindex on watch).
- M40-S10 (Settings, Features rows "Default for visitors without an account" and "Guests can watch", `launch:apply`): no mockup in L1. The admin settings form belongs to the settings screens (L3). Needs a Features mockup or a note on the existing Settings board.
- M40-S14 AC2 (remove an item with confirm and a 6 second Undo toast): S80 shows the overflow menu button only. No remove confirm or Undo toast board. Gap, reuse the S104 undo pattern.
- M40-S15 (finish a save after sign in, toast "Added to My List"): not drawn.
- M40-S09 AC5 (kids profile hint cookie `__Host-ad_gaud` persists after sign out): behaviour only.
- M40-S16 AC1 and AC2 (daily hash, no id in Kids mode), M40-S11 AC1 to AC4 numbers.
- R18 (`guestAudience` default General), R20 (guests see up to 12): no maturity badge is drawn on guest cards. Build shows the existing badge, check it against DS 11.19 contrast.

## What remains for the build

Exact CSS and component notes.

- Rows: `--cards-visible: 2.3` base, 3.3 at 600, 4.3 at 960, 5.3 at 1280, 6.3 at 1920. Card width `calc((100% - var(--page-gutter) - var(--gap) * floor(var(--cards-visible))) / var(--cards-visible))`, rail `padding-left: var(--page-gutter)` and no right padding so the next card peeks. Gap 8 base, 12 from 960. Boards match this at 360 (143.0 px cards at 8 px gap) and at 1360 (236 px cards at 12 px gap).
- Skeleton rows must use the same width formula so they do not shift when rows load (finding 14).
- Hero (R12, R36): scrim layers as in finding 2. Add a top scrim of `linear-gradient(180deg, rgba(14,15,19,.7), rgba(14,15,19,0))` 120 px high under the guest header, and give header buttons over the hero a `rgba(14,15,19,.6)` backing so contrast does not depend on artwork. Hero controls from the L2 spec, no controls and no rotation under Data saver or `prefers-reduced-motion: reduce`.
- Guest header on a phone (360 safe): wordmark `font-size: 15px`, Sign in `padding: 0 12px`, icon buttons 44 px with 2 px gap. In Kids mode show the logo mark only (`aria-label` is the platform name from settings, not hardcoded) with the Kids mode badge, search and menu.
- Switch: keep `role="switch"` with `aria-checked` on the 56 px row, the visual track can stay 52 by 30. Off track `--color-border-strong` equivalent `#6A6E78` is not a token yet, so use the strong border token if it reaches 3 to 1 on `--color-surface`, otherwise add a token.
- Player rail: unfilled `#6A6E78` as a token (for example `--color-player-rail`, R34), buffered a lighter token, fill `--color-accent`. Keep the 44 px hit area.
- Storage notice (R26): render in the site layout, not in the watch layout. A route check that the notice is absent on `/watch/*` belongs in the test list. Text, cookie names and life come from settings with the doc defaults.
- Clear history copy (R17): build the list from the keys actually removed so the text cannot drift from the code.
- Import error (R39): one action Retry plus an icon close button with `aria-label="Dismiss"`. The default prompt is `role="region"` with an `aria-label`, not `role="alert"`. Only the error state uses `role="alert"`.
- All new copy goes through `msg()` (plan 4.9). "Continue learning" is the configurable default row title (R14).

## Blocks for the build

None. The designs now satisfy the rulings that touch this lane. Two gaps need a decision before the slices that depend on them, neither blocks slices 1 to 4: the L1 Features settings form (M40-S10) and the remove with Undo flow for guest Continue learning (M40-S14).
