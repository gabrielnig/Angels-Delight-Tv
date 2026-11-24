# L10 UI review: account security and reach (S170 to S181)

Reviewer: `angels-delight-design-system` checklist. Date: 24 November 2026. Inputs: `RULINGS.md` (rulings win), `docs/plan/v2/L10-account-and-reach.md`, `docs/DESIGN-SYSTEM.md`, the audit, mockups S170 to S179 plus S180 and S181 added in this review. Rulings applied: R24 (scope), R30 (44 px), R31 (hover guard, standard `reduce`), R38 (`--font-mono`, Google mark exception).

How it was measured: a Playwright script rendered every file at 1360 (desktop), 390 and 360 (mobile, frame width forced to 360 and every element checked for horizontal overflow) and 1920 (TV, S177). Per file it measured the box of every link, button, switch, input and OTP cell (44 px minimum), the contrast of every text node against its effective background (4.5:1, large text 3:1), icon strokes against 3:1, em and en dashes, emoji and font sizes under 12 px. Rings, the Google button and the TV pairs were computed separately. Final run: zero target failures, zero overflow at 360, zero dashes or emoji. The two "contrast" hits left in S175 (yellow caption text) are false positives: the text sits on the dark preview gradient (7.4:1 and 10.0:1), the script cannot read gradients.

## Verdict per screen

| Screen | Verdict | Note |
|---|---|---|
| S170 Security overview (d, m) | Approve after fixes | Header nav was 19 px tall (fixed). Card order, collapsed mobile cards, skeleton, errors and the 90 day login history sentence are present. |
| S171 Two step setup (d, m) | Approve after fixes | Setup key now `--font-mono`. QR has the text alternative. Wrong code, locked and cancel states present. |
| S172 Recovery codes and challenge (d, m) | Approve after fixes | Codes were in Inter (R38), now `var(--font-mono)`. Needed "Lost your phone? Contact support" is drawn. |
| S173 Google sign in (d, m) | Approve after fixes | Button stroke was `#8A8D94` and label `#1A1C22`, now Google values (`#747775` 4.53:1, `#1F1F1F` 16.5:1). Absent state drawn. |
| S174 Viewing activity (d, m) | Approve after fixes | Clear dialog lacked the "does not delete your account" sentence, and the confirm said "Clear all". Both fixed. Remove is 44 px with 8 px space. |
| S175 Playback settings (d, m) | Approve after fixes | Switches were 48 by 28 hit areas (R30). Now 56 by 44. Yellow refusal state and Kids lock drawn. |
| S176 Sign out everywhere (d, m) | Approve after fixes | TV icon read as a desktop. New `tv` glyph. Close button shrank to 34 px, now locked at 44. |
| S177 TV mode (1920) | Approve after fixes | Three CSS typos (`#fffoutline`) removed every focus ring on the title page, the empty row and the activate screen. Fixed. Seek rail was 1.77:1, now 3.75:1 (R34). |
| S178 Offline downloads (d, m) | Not built now (R24) | Design record. "Not built now" band added. Targets and contrast pass. |
| S179 Passkeys (d, m) | Not built now (R24) | Same. |
| S180 Data and privacy with Viewing activity (d, m), new | Approve | The missing link and sentence. Pill row scrolls so the active pill shows. Footer links raised to 44 px wide. |
| S181 Security dialogs (d, m), new | Approve | Turn off 2FA, new backup codes, remove Google, "Set a password first", admin reset. |

## Findings

| # | Sev | Screen | Finding | Status |
|---|---|---|---|---|
| 1 | Blocker | S177 | Typos `color:#fffoutline:...` and `#8A8D94outline:...` dropped the declaration, so the focus ring is missing on the title page button, the empty row button and "Get a new code". A TV screen without a ring is unusable. | Fixed |
| 2 | Major | S170 to S179 desktop | Header nav links 19 px tall (R30). | Fixed (`header nav a` 44 px) |
| 3 | Major | S175 | Three switches had a 28 px tall target (R30). | Fixed (56 by 44 target) |
| 4 | Major | S172, S171 | Recovery codes and setup key in Inter (R38, plan finding 14). | Fixed (`--font-mono`) |
| 5 | Major | S177 | Seek rail 1.77:1 on the player surface (R34). | Fixed (3.75:1) |
| 6 | Major | missing | No screen for Turn off 2FA (S04 AC1), Get new codes password step (S03 AC3), Remove Google, "Set a password first" refusal, or admin Reset 2FA (S04 AC2, R24). | Fixed, S181 |
| 7 | Major | missing | Data and privacy had no Viewing activity link and no sentence that clearing activity keeps the account (plan finding 9). | Fixed, S180 and S174 |
| 8 | Major | S173 | Google button not on Google's values (stroke 3.32:1 grey, wrong label colour). | Fixed, rules in plan 12.2 |
| 9 | Minor | S176, S174, S175 | Dialog close span had no role or name and shrank below 44 px. | Fixed |
| 10 | Minor | S176, S170 | TV session icon indistinguishable from desktop. | Fixed, spec in plan 12.3 |
| 11 | Minor | S174 | "Clear all" did not say what it clears. | Fixed, "Clear activity" |
| 12 | Minor | S178, S179 | Mockups looked buildable though R24 says not now. | Fixed, banner |
| 13 | Minor | S177 | Activate screen highlights "Home" in the TV nav. It is not a nav page, no item should be active. | Open, build |
| 14 | Minor | S177 | State 4 safe area frame: the My List caption line sits below the 54 px bottom inset. The build must keep captions inside the inset. | Open, build |
| 15 | Note | S177 | Smallest TV text is 21 px (meta) at 1920, equal to 14 px at the 1.5 root factor. Acceptable, do not go lower. Phone approval card inside the frame is phone sized on purpose. | Note |
| 16 | Note | all | Icon stroke is 2 in `account/icons.tsx` but DESIGN-SYSTEM section 9 says 1.5. Mockups follow 2. L8 should settle the doc. | Note for L8 |
| 17 | Note | S173 | Google asks for Roboto Medium in the label, we keep `--font-sans` so one family loads. Logged as recommended in plan 12.2. | Note |
| 18 | Note | S170 | Mock dates and "Lagos, Nigeria" are sample copy. The build uses the formatter and "Unknown place". | Note |

## Settled questions

- `--font-mono`: exists in `tokens.css` line 88, missing from the doc. Exact doc edits in plan 12.1.
- Google mark exception text and skill grep ignore: plan 12.2.
- TV icon for `icons.tsx`: plan 12.3 (also `tablet`, `clock`, `eye`).
- Data and privacy link and clearing sentence: plan 12.4, mockup S180.
- Contrast figures: Google stroke 4.53, label 16.5, TV ring blue on page 4.81, on peach tile 4.31, on lemon tile 4.72, yellow ring on player 12.47, switch off track 4.88, on track 5.25, seek rail 3.75.

## What changed

All edits are in `docs/mockups/v2/L10/` and mirrored into `/home/claude/ad/project/`: shared CSS (nav links, switch, `--font-mono`, code face), Google button values, three S177 typos and rail colour, TV glyph, close button, Clear activity copy, Not built now bands, and two new file pairs (S180, S181). The plan gains section 12 Amendments.

## What remains for the build

- Real `<button>` and `<a>` elements everywhere (mockups use spans with `role="button"`), `:focus-visible` rings from tokens, `hover: hover and pointer: fine` guard on every hover style (R31), `prefers-reduced-motion: reduce` handling for skeleton shimmer, dialog fade, spinners and the 1.1 TV tile scale (static frames cannot show it).
- Dialogs trap focus, close on Escape, restore focus; the S176 and S181 dialogs become bottom sheets under 640 px.
- Switch needs `role="switch"` with `aria-checked`, and the state word ("On", "Off") in the accessible name.
- OTP: one labelled group "6 digit code", `autocomplete="one-time-code"`, `inputmode="numeric"`, paste fills all cells. Recovery codes: `role="list"`, Copy gives a live "Codes copied" status, Download as text.
- Strings in `@ad/shared/messages`, including the new S180 and S181 copy.
- Skip to content link and `[data-focusable]` order for TV mode, `tv.css` loaded only under `html[data-tv]`.
- Google button, link page, mark file `GoogleMark.tsx`, doc and skill edits from plan 12.2, applied by L8 or the lane that builds the button.
- `DeviceKind` from the server, icons `tv`, `tablet`, `clock`, `eye` added.
- Findings 13 and 14.

## Story AC the design cannot show

- S01: AC2 confirmation email, AC3 pending secret discarded, edge "starting again replaces the unconfirmed secret", secret encrypted under the user key.
- S02: AC1 no account session before the code, AC3 replay guard, clock drift of one step, lockout not revealing password correctness (the expired state is drawn).
- S03: AC2 low codes email sent once, AC3 old codes stop working, case and dash tolerance.
- S04: AC1 other sessions revoked and email, AC2 audit entry and email to the person, AC3 non admin refused, staff cannot turn 2FA off.
- S05 to S07: all link rules (verified email, adopt unverified, staff excluded, suspended), state and PKCE checks, the guest progress import prompt after Google (the same prompt as after password sign in, owned by the guest lane, not drawn here).
- S09 to S10: keyset pagination, unpublished titles dropped, undo window of five minutes, audit entry without titles, Kids lock server side.
- S11: caption classes used by the real player and the contrast refusal are L4 and test territory.
- S12 to S14: revocation reaching playing devices within 5 minutes, new device hash and once an hour rate, 90 day purge.
- S15 to S16: spatial navigation, back key codes, arrow keys kept for the caret in text fields, code polling and expiry.
