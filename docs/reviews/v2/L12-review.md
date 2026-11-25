# L12 UI review: mobile header (S182 to S185)

Reviewer: `angels-delight-design-system` checklist. Date: 25 November 2026. Inputs: `docs/DESIGN-SYSTEM.md` (11.7 to 11.12, 13), `docs/plan/v2/RULINGS.md` (R30, R35, R36, R37, R39), the built header code (`packages/ui/src/components/TopNav.tsx`, `apps/web/src/components/guest/GuestChrome.tsx`, `ViewerChrome.tsx`, `notices/ViewerBell.tsx`), the owner feedback from Unique (the phone Home header is crowded).

Files: `docs/mockups/v2/L12/S182_mobile_header_options_m.dc.html` (options), `S183_mobile_header_states_m.dc.html` (recommended option B, all states), `S184_mobile_header_stress_m.dc.html` (320, 360, 414), `S185_mobile_header_landscape_watch_m.dc.html` (landscape and /watch).

How it was checked: every file renders with the real `tokens.css` names declared once in a `:root` block and `var(--token)` everywhere else. Greps on all four files: 0 hex values outside `:root`, 0 raw rgb or rgba (the only rgba is `rgba(var(--scrim-rgb), n)`), 0 em or en dashes, 0 emojis, 0 `outline: none`, 0 pixel font sizes, fonts only `var(--font-sans)` and `var(--font-display)`. S184 was measured in Chrome (66 cases, tables in the file): no horizontal overflow, no overlapping or off screen control, no wrapped control label, every control at least 44 by 44. Contrast was computed with alpha compositing (script kept outside the repo), figures below.

## What was found in the built header (the owner's complaint)

On a 390 px guest Home the bar holds the logo and name, Sign in, a Create account button and a Menu button (`GuestChrome.tsx`), plus the language picker once a second language is live. The name loses almost all its width and Sign in overlaps the logo in the rendered frame. Search is missing from the guest bar on phones (links are `display: none` under 960 px) and only exists as a tab. The signed in bar is already logo, search, bell, avatar.

## Recommendation

Option B: logo, Search, one account icon that opens a bottom sheet (Sign in, Create account, Kids mode, Language, Help). Reasons: three controls instead of four plus the name squeeze; same skeleton as the signed in bar so signing in changes only the last slot; icons only, so Yoruba, Igbo and Hausa labels cannot break it (A fails at 360 with a long Sign in label, measured); smallest build that keeps the tab bar, the 40 px solid switch and the 11.9 bottom sheet. A's strong idea is kept: Sign in is the only filled button in the sheet. C was rejected (100 px overlay, repeats the tab bar, largest build, no tab bar breaks section 13).

## Contrast (computed)

| Pair | Ratio | Needs |
|---|---|---|
| White icons and text on the bar scrim 0.85 over pure white poster | 12.63 | 4.5 |
| Same over cream F6F3E8 / pale lemon FFF3C9 | 12.98 / 13.01 | 4.5 |
| Focus ring accent on the scrim over white | 8.22 | 3 |
| Focus ring primary on surface / on bg | 5.25 / 4.81 | 3 |
| Ink on solid bar | 17.03 | 4.5 |
| Muted tab label on surface (11 px) | 6.31 | 4.5 |
| Current tab, primary on surface | 5.25 | 4.5 |
| Ink on Kids badge accent | 11.09 | 4.5 |
| White on bell badge danger | 6.57 | 4.5 |
| Today: chip fill 0.6 over white (white text) | 5.03 | 4.5 (passes, thinner) |
| Today scrim hold 70 percent under a 47 px inset, icon at y 80 / 87 / 90 | 5.64 / 2.99 / 2.35 | 3 (fails at the bottom of the icon) |

## Findings

| # | Sev | Screen | Finding | Status |
|---|---|---|---|---|
| 1 | Major | Build (`components.css` `.ad-nav::after`) | The nav scrim holds 0.85 to 70 percent of the bar. With a top inset (viewport-fit=cover, 47 px) the bar is 103 px, the hold ends at 72 px and the icon bottoms fall to 2.99:1 and 2.35:1 over a pale poster. | Fixed in S183 spec: new token `--nav-scrim-fade` (`--space-4`), scrim layer extends that far below the bar and holds 0.85 through the whole bar. Build follows, D-356. |
| 2 | Major | S183 draft | Pressed state used a raw `rgba(255,255,255,.28)` fill. | Fixed: `--color-player-border` on clear, `--color-surface-sunken` on solid |
| 3 | Major | S184 first pass | Brand name truncated at 360 px for the signed in bar even with the short name (bell plus avatar leave 152 px). | Fixed: name drops to `--text-small` under 400 px and hides under 400 px when the bell shows, and under 340 px always. The link keeps its aria-label. |
| 4 | Major | Build (`ViewerChrome` / `TopNav`) | The avatar menu is a popover on phones, 11.9 says bottom sheet. | Logged, build follows the mockup (S183 frames 7 to 9) |
| 5 | Minor | Build | No `viewport-fit=cover`, no `env(safe-area-inset-top/left/right)` anywhere, only the tab bar uses the bottom inset. Without cover the browser keeps content below the notch, so nothing is hidden today, but an edge to edge hero needs both. | Spec in S183 and S185. Fallback if not adopted: keep no cover and drop the insets, nothing else changes. |
| 6 | Minor | S183 | Page gutter first rendered as 56 px because `--page-gutter` is viewport based and the page was viewed on a desktop. | Fixed: frames pin 1rem, the phone value |
| 7 | Minor | S182 | Hero frames look almost black: the real mobile hero scrim (R36 tokens 72 / 82 / 96 percent) covers most of the poster. Not a mockup fault. | Note: S183 frame 14 shows a white poster with only the bar scrim to prove the worst case. Consider tuning the hold in a later hero pass. |
| 8 | Minor | S184 | Tab labels over 12 characters truncate with an ellipsis (never wrap). | Proposal: translation workspace warns above 12 characters for `nav.*` tab labels. Open question. |
| 9 | Note | S184 | Yoruba, Igbo and Hausa strings are the unreviewed drafts (D-345) plus longer illustrative ones. They are test data, not translations. | Noted on the page |
| 10 | Note | S185 | Landscape uses 48 px bar and a 44 px tab bar with the label beside the icon, leaving 277 px of content on a 390 px high phone. | Accepted |

No Blocker is open. Checks Not applicable: skeleton (the bar never loads), upload progress, forms, captions, OTP, optimistic updates, desktop hover cards. Reduced motion: the bar fade and sheet slide become instant, stated in S183.

## Verdict per screen

| Screen | Verdict |
|---|---|
| S182 Options | Approve after fixes (hero scrim note) |
| S183 Recommended option, all states | Approve after fixes (findings 1 to 3, 6) |
| S184 Width stress test | Approve after fixes (finding 3, 8) |
| S185 Landscape and watch page | Approve |

Summary: 0 Blocker, 4 Major (3 fixed in the mockups, 1 for the build), 4 Minor, 2 Note. Verdict: Approve with minor fixes.
