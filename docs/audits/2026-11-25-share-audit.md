# Share audit (25 November 2026)

Lane L15a. Scope: the Share experience, mobile first. Method: the same public source only approach as `docs/audits/2026-11-24-netflix-rea-audit.md` (no decompiling, no DRM, no login). Each claim carries a confidence tag: verified (read on a public page), likely, inferred.

## 1. What L6 built (code audit, evidence in repo paths)

- `apps/web/src/components/share/ShareMenu.tsx`: one Share button. With `navigator.share` it opens the system sheet at once. Without it, a small absolutely positioned panel lists Copy link, then the admin enabled channels, then Close. Escape closes, Tab is trapped, focus returns to the button. A manual link field shows when the clipboard is blocked.
- `share-links.ts`: builders for WhatsApp (`wa.me`), Facebook (`sharer.php`), X (`x.com/intent/post`) and email (`mailto:`). Each appends a channel tag `?s=wa|fb|x|em|cp|nt` to the shared URL.
- `share.css`: panel turns into a fixed bottom sheet under 600 px with a 40 percent scrim. No handle, no grid, no thumbnail, no swipe, no animation, no reduced motion rule needed because nothing moves.
- Admin: `seo.share_channels` (site setting, `whatsapp, facebook, x, email`, default `whatsapp, facebook, x`, Email off by default per R26) and `seo.share_text_template` (`{title}` and `{siteName}`). Reader `lib/site/seo-settings.ts`, server helper `shareConfig(title)` in `server/seo/page-seo.ts`. Admin UI in `components/admin/site/DiscoveryTab.tsx`.
- Wired only into `TitleActions` (title page and series page). Kids profiles get no Share (M45-S06 AC4).
- Messages: `share.button`, `share.title.video`, `share.title.series`, `share.copy`, `share.copied`, `share.linkLabel`, `share.newTab`, `share.close`.
- Guard: `lib/consent/guard.ts` already lists `share` in `OPTIONAL_EVENT_KINDS` (dropped under Global Privacy Control or Do Not Track). `lib/analytics/browser.ts` honours it.
- Mockups: L6 `S135_share_menu` and `_m` (5 states: native, fallback sheet, copied toast, clipboard blocked, kids), `S136_link_previews` (what the link looks like in WhatsApp and Facebook). L6 note: `docs/lanes/L6-build.md` slice 5 says the analytics `share` event and the player end card share were not done.

## 2. Gaps (what is missing, with the owner's request in mind)

| # | Gap | Evidence | Impact |
|---|---|---|---|
| 1 | No Telegram, SMS or Messages target. Email exists but is off by default (R26). The stored array order is the menu order, but the admin screen only has on and off switches. | `SHARE_CHANNELS` has 4 ids | The owner asked for copy link, WhatsApp, Facebook, X, Telegram, email, SMS and the device menu. |
| 2 | On phones with `navigator.share`, the button skips our sheet. Viewers never see the labelled list, and a phone browser with a poor share menu loses Copy link and WhatsApp. | `onShare` in ShareMenu | Not the "all the places to share" experience asked for. |
| 3 | Sheet is a list of full width text buttons with no icons, no title and thumbnail preview, no link field, no handle, no close icon, no swipe to dismiss, no slide animation. | `share.css` | Does not look like a modern bottom sheet. |
| 4 | Desktop panel is a plain absolute box with no arrow, no icons, no preview. It can overflow the viewport on the right (anchored `left: 0`). | `share.css` | Layout risk near the right edge on the title page and hero. |
| 5 | Share exists only on title and series pages. Not on hero, hover card, card menu, watch page (which has its own separate Share that copies `window.location.href`, the watch URL) or the end screen. | grep: `WatchActions.share`, no share in `HoverCard`, `Cards`, `HomeHero` | Sharing is hard to find where people decide. |
| 6 | The URL shared is `window.location.href`: whatever is in the address bar (watch URL, start time, tracking params, a signed or session URL if one is ever added). | `ShareMenu.onShare`, `WatchActions.share` | Must be the clean canonical public title URL. |
| 7 | No analytics event per channel. The guard allows `share` but nothing sends it. | `OPTIONAL_EVENT_KINDS` only | No way to learn which channels matter. |
| 8 | No start at time option on the watch page. `start-at.ts` exists for resume but is not used for sharing. | `features/player/start-at.ts` | Nice to have, cheap. |
| 9 | Copy confirmation is a toast only. The toast may be missed by screen readers when the panel closes at the same moment. | `onCopy` closes then toasts | Needs a polite status inside the sheet. |
| 10 | No Telegram text builder, no SMS `sms:` builder (iOS and Android differ on `&body=` vs `?body=`), no encoding tests for emoji free but non Latin titles (Yoruba, Igbo, Hausa) or very long titles. | `share-links.test.ts` | Correctness risk for links. |
| 11 | No layout tests at 320, 360 and 414. | no Chromium test | Mobile quality is unproven. |
| 12 | Channel tag `?s=` is added to the copied link. That makes the copied link differ from the canonical one and leaks a tag into later shares (reshares keep the tag). | `withChannelTag` | Recommend: the link is clean; the channel is counted by the share click event only (D-ref logged in this lane). |

## 3. Netflix share behaviour (public sources)

- Mobile only on the Help Center. Verified: the Help Center article "How to share TV shows and movies on mobile devices" says to go to the details page of the show or movie, tap Share, choose the app, and finish inside that app. It names Android phones and tablets and iPhone or iPad. It does not describe a share control on the web version and lists no destinations, because the device share menu supplies them.
- Netflix opens the platform's own share sheet, not a custom list of social icons. Verified by the same article ("choose the app you want to use"). So the baseline Netflix behaviour is: one Share button on the details page, then the device sheet.
- Instagram Stories (2019, TechCrunch). Verified: for a time Netflix built its own in app share screen listing WhatsApp, Messages, Messenger, Twitter, Line and more, plus Instagram Stories, and shared title art with the show name. Recipients on a phone with the app see a "watch on Netflix" link to the title page. So Netflix has used both patterns: the system sheet and its own labelled app grid.
- Moments (2023 onward, Tom's Guide and Android Authority). Verified: during playback tap Moments (bottom left) then Save, then the Share icon. Destinations named: Instagram Stories, Messenger, X, WhatsApp and a copyable link. Saved moments can be shared later from the My Netflix tab. This is the closest Netflix has to "share from 1:23" and it is mobile only and on ad free plans.
- Logged out public title pages: the Netflix title URL pattern is `netflix.com/title/<id>`; our fetch tool could not read it (not on the tool allowlist), so web page share behaviour is unverified. Treat "no desktop share control" as likely, not verified.
- Web Share behaviour as documented publicly (MDN and web.dev): `navigator.share` needs a secure context and a user gesture, works on Android Chrome and Safari on iOS and macOS, is absent on most desktop Chrome and Firefox builds, rejects with `AbortError` when the person cancels, and `navigator.canShare` can pre check the payload. `navigator.clipboard.writeText` needs a secure context and a gesture and can reject, so a selectable field is the fallback.

## 4. Recommended behaviour for Angels Delight TV

Adapt, not copy. Netflix leans on the system sheet because it has the app. A free web platform for Nigerian families and the diaspora cannot assume a good system sheet (many phones show a slow or crowded one, and desktop has none), and the owner wants every place visible.

1. One Share button everywhere (icon plus label on pages, icon only 44 px on cards and hero).
2. Tapping it always opens our sheet. Under 600 px a bottom sheet (drawer): handle, close button, title with thumbnail preview of what is shared, a grid of 44 px plus targets with labels (Copy link, WhatsApp, Facebook, X, Telegram, Email, Messages, More), a visible link field with Copy button, a polite "Link copied" status. "More" opens the device share menu when `navigator.share` exists and is hidden when it does not.
3. From 600 px a popover anchored to the button (dialog on very short viewports) with the same content in a 4 column grid. Focus trap, Escape, scrim click, return focus.
4. The shared link is the canonical public title or series URL (`/title/<slug>`, `/series/<slug>`), built by one helper from `APP_ORIGIN` and the L6 `canonicalPath`. Never the address bar, never signed, never with `s=`.
5. Watch page and end screen share the title page link; the watch page adds an optional "Start at 1:23" switch that adds `?t=83` (seconds, read only by the watch page).
6. Kids profile: Share hidden entirely (recommendation kept from L6: no external links on a kids profile). Kids only titles are not shareable to non kids audiences (the share target is a kids only title, so the viewer is on a kids profile already). Logged in staff can share unpublished titles; everyone else gets no button because the page 404s.
7. Guests share without an account. No sign in prompt.
8. Analytics: one `share` event with property `channel` only (`copy`, `whatsapp`, `facebook`, `x`, `telegram`, `email`, `sms`, `native`) and the title id the page already knows. No URL, no text, no person data. Dropped under GPC and Do Not Track by the existing guard.
9. No third party scripts, pixels or SDKs: plain `https:` links, `mailto:`, `sms:` and the Web Share API.

## 5. Decisions taken here (logged in docs/DECISIONS.md)

- Always open our sheet, with More for the device menu, instead of jumping straight to the system sheet.
- Drop the `?s=` tag from copied and shared links; count by click event.
- Kids profiles: Share hidden.
- Start at time is on the watch page only, off by default.
- Keep the existing setting `seo.share_channels` (no new key, no migration). Extend its ids with `telegram` and `sms`. Default becomes `whatsapp, facebook, x, telegram, email, sms` because the owner asked for all of them (this overrides the R26 default that left Email off). Copy link and More are always there and are not settings (More hides itself when the device has no share menu).
