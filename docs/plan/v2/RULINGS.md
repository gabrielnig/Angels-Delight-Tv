# v2 rulings (24 November 2026)

Cross lane decisions taken by the main session using the recommended option, per CLAUDE.md. Where a lane plan or mockup disagrees with a ruling here, the ruling wins. Each ruling is logged in `docs/DECISIONS.md` with a real D-number by the lane that builds it. All are reversible unless stated.

## Product rules from the owner
- R01 No sign-up wall. Anyone browses and plays. Account only for My List, likes and ratings, cross device progress, profiles, kids lock, notifications.
- R02 The platform name, tagline, support email, colours and domain stay configurable. Nothing client specific is hardcoded.

## Cross lane conflicts
- R10 Card hover: L8 governs. Scale 1.25 after a 300 ms delay on `hover: hover and pointer: fine` devices only, no delay on mouse out, transform origin left for the first visible card and right for the last. L5 mockups and plan adjust to this.
- R11 Fractional columns for rows: 2.3, 3.3, 4.3, 5.3, 6.3 (L8). Kids phone rows also use 2.3, not 2.1 (L2).
- R12 Hero: auto rotate on by default at 10 s, one setting plus an interval setting, Pause button, stops on hover and focus, off under reduced motion and Data saver, stops after two loops (L2). More info is translucent with a white border, not yellow. The design system wording for hero secondary is corrected to match. Arrows sit beside Pause.
- R13 Optional hero preview clips only where `saveData` is off and the connection is fast. Safari and Firefox are not eligible by default (setting to enable).
- R14 Default top row title is "Continue learning" (configurable).
- R15 Autoplay next defaults to true for non-kids profiles, false for kids profiles. Countdown 5 to 10 s, cancellable (L4).
- R16 Cast: AirPlay now behind a device spike. Chromecast is Could, not built.
- R17 Guest kids toggle label is "Kids mode" everywhere, with a help line. Kids My List copy: "Ask a grown-up to sign in so you can keep a list that follows you on every device." Clearing history names everything it removes, including the import answer and the Kids mode choice. Phone watch page has no sign in button for guests on purpose.
- R18 Guest default audience: General. Setting `guestAudience` (general or kids).
- R19 Guest cookie is `__Host-ad_guest`, set only inside the playback session route handler. Guest segment URL TTL 15 to 20 minutes. Guest progress in one localStorage key with a 100 entry cap.
- R20 Maturity labels default G, PG, 12, 15, 18 (setting). Guests see up to 12 by default. Rating options in the editor can be reduced by setting.
- R21 Bulk approve of captions and deleting a series are Admin only. Editors approve captions one track at a time.
- R22 Captions switch per video: On, Off or follow site default. Admin only to change. Off hides CC and keeps each profile's saved choice.
- R23 Languages: ship the interface catalogs first (no engine needed). Translation engine stays behind an adapter and is off until commercial plans are confirmed. NLLB is non commercial, so with sponsors enabled use a commercially licensed engine or a paid API. Yoruba and Igbo headings use Inter (the display font misplaces combining marks). Font coverage tests include Hausa ɓ ɗ ƙ ʼ and use NFD aware checks.
- R24 Viewer 2FA is optional TOTP with recovery codes. A lost phone and codes are reset by an Admin only. Google sign in is optional and hidden unless both keys are set. Passkeys and offline downloads are not built now.
- R25 Monetization is off by default. Paystack hosted redirect checkout only (no third party scripts). Sponsor and donate surfaces never show for kids profiles or kids mode. Sponsor names, organisation name, bank details and amounts are client inputs.
- R26 Search engines: kids only titles are not indexed. Storage notice is a short informational notice, not an Accept and Reject banner, text configurable, never on watch pages. Share list: WhatsApp, Facebook, X, copy link, configurable.
- R27 Light default theme stays. A Night preset is a Could.

## Design fixes that apply to every lane
- R30 44 px minimum touch target everywhere, including breadcrumb links, admin sidebar links (raise 40 to 44), seek bar hit area (32 to 44) and the bulk bar "Select all N that match" link.
- R31 Hover only rules live inside `@media (hover: hover) and (pointer: fine)`. Reduced motion uses the standard `reduce` value.
- R32 Breadcrumb: one shared component, links `min-width: 44px`, the current crumb is `display: inline-block; line-height: 44px` so the ellipsis works.
- R33 Locked row checkbox spacer is 20 px wide.
- R34 Seek rail unfilled colour reaches 3:1 against the player surface (a lighter token such as #6A6E78).
- R35 Nav active underline on a clear nav uses the dark accent ring colour, not blue. The nav colour flip happens as one step at 35 percent of the fade and gate tests do not sample inside the fade.
- R36 Hero scrim: desktop holds 0.85 to 40 percent, mid stop at 60, end at 100. Mobile holds 0.85 to 50 percent, mid at 65, end at 80. White text must stay above alpha 0.57 in the title zone.
- R37 Tile focus uses an offset outline (3 px, 2 px offset) plus a transparent outline for forced colours. Profile tile focus ring gets the same.
- R38 Caption badge on cards gets a contrast safe fill. Disabled actions on the bulk bar use a token, not a raw grey. A `--font-mono` token is added for recovery codes. The Google mark is the one documented brand colour exception.
- R39 Error states show one action. Old mockups S24, S33 and S20 are updated to match the player and copy rules.
- R40 Decision ids D-108, D-109, D-123, D-124 stay as they are, with a register and a test that blocks new duplicates. `ai-context.md` is updated to "decisions up to the highest D-number on main".
