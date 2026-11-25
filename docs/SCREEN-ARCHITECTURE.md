# Screen Architecture

Route map, shared layout, every screen with its parts and states, and the numbered list of screens to mock up. Story ids refer to `docs/USER-STORIES.md`. Module ids refer to `docs/MODULES.md`.

Visual direction (from `docs/PROJECT-BRIEF.md`, all changeable from admin theme settings): off-white background `#F5F5F2`, ink `#1A1C22`, muted `#5B606B`, border `#DEDDD6`, banner blue `#1F6FB5`, accent yellow `#FFC93C`. Home: horizontal rows, 5 cards visible on desktop, hero banner. Watch: dark player on the off-white page, pastel up-next tiles. Admin: dark side menu. Existing mockup sources: `/home/claude/ad/project/*.dc.html` and the published canvas "Angels Delight TV: UI Mockups".

## 1. Principles applied to all screens

From `/home/claude/shared-protocols/docs/UI-UX-STANDARD.md`:

- **Familiar patterns (Jakob).** Netflix style profile picker, rows, hero, and standard player controls.
- **Fewer choices (Hick, Miller).** Group content in clusters of 5 to 7. Hide secondary settings behind menus.
- **Proximity and common region.** Related inputs sit in bordered cards.
- **Von Restorff.** One strong primary action per screen (Play, Publish, Upload).
- **Doherty threshold.** Every interactive control gives visual feedback within 400 ms.
- **Fitts.** Tap targets at least 44 by 44 CSS px. Primary controls within thumb reach on phones.
- **Loading.** Skeleton screens with left to right shimmer and matched geometry for waits over 300 ms, spinners only for inline updates under 3 seconds with locked button size, progress bars for anything over 3 seconds (uploads, encoding), optimistic UI for non-destructive actions with rollback.
- **Forms.** Lazy then eager validation (on blur, then on change), `aria-describedby` and `aria-invalid`. Info toasts auto dismiss in 4 to 6 seconds, error toasts persist.
- **Passwords.** Length first, live checklist and strength meter, paste never blocked, visibility toggle, `autocomplete="new-password"`.
- **Codes.** Single string state across slots, paste sanitised, auto advance and reverse, `inputmode="numeric"`, `autocomplete="one-time-code"`, resend behind a 30 to 60 second countdown.
- **Tables.** Cursor pagination, page state in the URL query string, scroll offset cached in sessionStorage.
- **Uploads.** Active drag feedback (border, tint, microcopy), honest progress (percent, speed, ETA), inline retry that resumes, rich preview card, independent multi file lanes.

## 2. Breakpoints and responsive rules

| Name | Width | Notes |
|---|---|---|
| base | under 600 | Phones. Design baseline is 360. Rows show 2.3 cards. |
| sm | 600 to 959 | Large phones, tablets. 3.3 cards per row. |
| md | 960 to 1279 | Small laptops. 4.3 cards per row. |
| lg | 1280 to 1919 | Desktop. 5.3 cards per row. |
| xl | 1920 and up | Wide desktop. 6.3 cards per row, rails cap at 120rem. |

- Mobile first CSS. Cards per row follow the row container: base 2.3 (peek), sm 3.3, md 4.3, lg 5.3, xl 6.3 (peek of next). Gutter is `clamp(1rem, 4vw, 3.5rem)`.
- Admin is designed for lg and up, with a usable md and a reduced sm (lists become cards, side menu becomes a drawer). Upload and caption review must work on a laptop first, phone second.
- Safe area insets respected on notched phones.
- No horizontal page scroll at any width. Rows scroll horizontally inside their own container.

## 3. Route map

### 3.1 Public (signed out allowed)

| Route | Screen | Notes |
|---|---|---|
| `/` | Landing (signed out) or Home (signed in with profile) | Redirect logic below |
| `/sign-in` | Sign in | Accepts `next` |
| `/sign-up` | Sign up | May be invite only |
| `/verify-email` | Verify email | Needs pending account |
| `/verify-email/confirm?token=` | Link confirmation result | |
| `/forgot-password` | Forgot password | |
| `/reset-password?token=` | Reset password | |
| `/title/[slug]` | Title detail (public preview when signed out) | |
| `/terms`, `/privacy` | Legal pages | |
| `/about`, `/help` | About, Help and contact | |
| `/offline` | Offline screen | Served by service worker. Offers Reload the page only |
| `/maintenance` | Maintenance page | 503 |
| `/unsupported` | Unsupported browser | Static |
| `*` | 404 | |

### 3.2 Viewer (signed in)

| Route | Screen | Profile needed |
|---|---|---|
| `/profiles` | Profile picker | No (session only) |
| `/profiles/manage` | Manage profiles | No, blocked for kids profile |
| `/profiles/new` | Create profile | No |
| `/profiles/[id]/edit` | Edit profile | No |
| `/browse` | Browse (all categories) | Yes |
| `/browse/[categorySlug]` | Browse by category | Yes |
| `/search?q=` | Search | Yes |
| `/title/[slug]` | Title detail | Yes |
| `/series/[slug]?season=` | Series page | Yes |
| `/watch/[videoId]?t=` | Watch | Yes |
| `/my-list?filter=&sort=` | My List with filter and sort kept in the URL (M44-S24) | Yes |
| `/notifications` | Notifications, the phone page behind the bell (M44-S11). Kids profiles see a plain explanation | Yes, adult only |
| `/account` | Account overview | Yes, adult only |
| `/account/security` | Password, email, sessions | Adult only |
| `/account/notifications` | Notification choices and the email digest (M44-S14, S15) | Adult only |
| `/settings/playback` | Playback settings | Yes (limited for kids) |
| `/account/data` | Export and delete | Adult only |

### 3.3 Admin

| Route | Screen | Minimum role |
|---|---|---|
| `/admin/login` | Admin login | none |
| `/admin/login/2fa` | Two factor code and enrolment | partial session |
| `/admin/invite/[token]` | Accept invite | none |
| `/admin` | Dashboard | Analyst |
| `/admin/videos` | Videos list | Editor (Analyst read) |
| `/admin/videos/upload` | Upload | Editor |
| `/admin/videos/[id]` | Video edit and status | Editor |
| `/admin/videos/trash` | Trash | Editor |
| `/admin/encoding` | Encoding queue | Editor |
| `/admin/captions` | Caption list | Editor |
| `/admin/captions/[videoId]` | Caption review | Editor |
| `/admin/series` | Series list | Editor |
| `/admin/series/[id]` | Series edit | Editor |
| `/admin/categories` | Categories | Editor |
| `/admin/home` | Home curation | Editor |
| `/admin/theme` | Theme settings | Admin |
| `/admin/users` | Users list | Admin (Analyst counts only) |
| `/admin/users/[id]` | User detail | Admin |
| `/admin/analytics` | Analytics overview | Analyst |
| `/admin/analytics/[videoId]` | Per video analytics | Analyst |
| `/admin/audit-log` | Audit log | Admin (content), Super admin (all) |
| `/admin/roles` | Roles and invites | Super admin |
| `/admin/site-settings` | Site configuration and pages | Admin (flags Super admin) |
| `/admin/languages` | Languages: status, publish, engine | Editor (view), Admin (approve, publish), Super admin (override, engine) |
| `/admin/languages/[locale]` | Translate workspace, import and export, missing keys | Editor |
| `/admin/system` | Jobs, storage, player quality | Super admin |
| `/admin/account` | My admin account | any admin |

### 3.4 Redirect and guard rules

1. Signed out on a protected route: go to `/sign-in?next=<path>` (same-origin paths only).
2. Signed in without a profile selected: go to `/profiles` (single profile accounts auto select).
3. `/` signed out shows Landing. `/` signed in with profile shows Home.
4. Unverified account: any viewer route redirects to `/verify-email`.
5. Kids profile on an adult only route: password gate dialog (screen 17), not a redirect.
6. Admin routes without admin session: `/admin/login`. Without permission: the "No access" screen (HTTP 403, same layout, menu hidden).
7. Unknown or hidden title or video: the 404 screen.
8. Pending deletion account: only the cancel deletion screen.

## 4. Shared layout and components

### 4.1 Viewer shell
- **Header.** Logo or platform name (left), primary links Home, Browse, My List (desktop), search icon, profile menu (avatar, name, Switch profile, Account, Playback settings, Sign out). On mobile (L12, S182 to S185): one bar for visitors and signed in viewers, the logo, a search icon, the bell when signed in and one account icon that opens a bottom sheet (a person for a visitor, the avatar when signed in), with a bottom tab bar (Home, Browse, Search, My List) for thumb reach. Header is transparent over hero, solid after 40 px of scroll, and absent on Watch.
- **Footer.** Terms, Privacy, About, Help, support email, platform name and year. Compact on mobile.
- **Toasts.** Info toasts auto dismiss in 4 to 6 seconds. Error toasts persist with a close and, where useful, a Retry action. Live region announced.
- **Banners.** Offline, maintenance, Data saver notice, install prompt (dismissible).
- **Kids shell.** Reduced header (logo, search, Exit kids mode), larger cards.

### 4.2 Admin shell
- **Side menu (dark).** Dashboard, Videos, Upload, Encoding, Captions, Series, Categories, Home curation, Theme, Users, Analytics, Audit log, Roles, Site settings, System. Items hidden by role. Collapses to icons at md, drawer at sm.
- **Top bar.** Page title, global search (videos), notification bell, upload progress chip (visible while uploads run), admin menu (My account, Preview site, Sign out).
- **Content area.** Page header with primary action, local filter and search bar inside each container, card based sections.
- **Session timer warning.** Dialog 2 minutes before expiry.

### 4.3 Reusable components

Engagement additions (M44): the notification bell sits at the right of the viewer top bar for adult profiles, with a popover on desktop and a link to `/notifications` on phones. Home rows now include Continue learning with a menu on each card, and the curated row kinds Trending now, Top 10 and Most liked.
Title card, row, hero, skeleton variants (card, row, table row, form), status badge (colour plus text), progress bar, empty state block, error card with retry, confirm dialog (names the object, states consequence), toast, tabs and pills (solid fill when active, neutral border when inactive), data table with cursor pagination, drop zone, upload row, upload preview card, code input, password field with checklist and meter, avatar tile, chip, switch, select, tooltip, stepper, rich text editor (minimal), colour field, drag and drop list with keyboard reordering, video player, caption cue editor, chart with table toggle.

### 4.4 Standard states (every screen defines these)
- **Loading.** Skeleton with matched geometry after 300 ms. Under 300 ms show nothing intermediate.
- **Empty.** Illustration free, short text, one clear action.
- **Error.** Plain words, what happened, Retry, request reference id for server errors.
- **Offline.** Banner plus cached content where available, writes queued where the story allows.
- **No access.** For permission failures.

## 5. Numbered list of screens to mock up

Format: number, name, route, form factors to mock. "M" is mobile (360 px), "D" is desktop (1280 px), "M+D" means both, "same" means one layout that scales.

### A. Entry and authentication (viewer)
1. Landing and Sign in, `/` and `/sign-in` (M+D)
2. Sign up with live password checklist (M+D)
3. Verify email, code entry with slots and resend countdown (M+D)
4. Email link confirmation result, success and expired states (M)
5. Forgot password (M+D)
6. Reset password (M+D)
7. Sign in lockout state (M)
8. Public title preview for signed out visitor (M+D)

### B. Profiles
9. Profile picker (M+D)
10. Manage profiles (M+D)
11. Create or Edit profile, with avatar picker and kids toggle (M+D)
12. Delete profile confirm dialog (same)
13. Kids exit password dialog (M)

### C. Browsing
14. Home, adult, with hero and rows (M+D)
15. Home, kids (M+D)
16. Browse by category (M+D)
17. Search with results, suggestions, and no results (M+D)
18. Title detail (M+D)
19. Series page with season selector (M+D)
20. My List (M+D)

### D. Watching
21. Watch page, desktop layout with dark player, details and pastel Up next tiles (D)
22. Watch page, mobile portrait and landscape (M)
23. Player menus: speed, quality, captions, settings sheet (M+D)
24. Player states: buffering, connection lost, offline, error, expired session (M+D)
25. End screen and Up next countdown (M+D)
26. Shortcuts help dialog (D)

### E. Account and settings
27. Account overview (M+D)
28. Account security: password, email, sessions (M+D)
29. Playback settings (M+D)
29a. Notification settings (M+D)
30. Data and privacy: export, delete account (M+D)
31. Legal page, About, Help (same)

### F. System pages
32. 404 (M+D)
33. Server error with reference id (M+D)
34. Offline screen (M)
35. Maintenance (same)
36. Unsupported browser (same)
37. Install to home screen banner and iOS instructions (M)

### G. Admin: access
38. Admin login (D)
39. Admin two factor, enrolment and code entry, recovery codes (D)
40. Accept admin invite (D)
41. No access screen (D)

### H. Admin: content pipeline
42. Dashboard (D, M reduced)
43. Videos list, with filters, bulk bar, empty state (D, M cards)
44. Upload, with drop zone states, multi file queue, progress, failed row with Retry, completion preview cards (D, M)
45. Video edit and status checklist, with preview card (D, M)
46. Poster picker and crop (D)
47. Publish and schedule dialog (D)
48. Encoding queue (D, M)
49. Caption list (D)
50. Caption review, cue list with video (D, M)
51. Series list (D)
52. Series edit with episode ordering (D)
53. Categories (D)
54. Trash (D)

### I. Admin: control
55. Home curation with live preview (D)
56. Theme settings with live preview and contrast warnings (D)
57. Theme history (D)
58. Users list (D)
59. User detail with support actions (D)
60. Analytics overview (D, M reduced)
61. Analytics per video with retention curve (D)
62. Audit log with detail panel (D)
63. Roles and invites, permission matrix (D)
64. Site settings: details, flags and limits, pages editor, invite codes (D)
65. System: jobs, storage, player quality (D)
66. My admin account (D)

66 screens (some are states or dialogs that need their own mockup because they carry unique layout). Screens 21 and 22 share one route. Screens 23 to 26 are states of the Watch route. Screens 12, 13, 47 are dialogs.

## 6. Screen specifications

Each specification lists purpose, layout regions, components, data needed, states, responsive behaviour, navigation in and out, and stories. Numbers match section 5.

---

### Screens 1 and 7. Landing and Sign in (`/`, `/sign-in`)

- **Purpose.** Let a returning viewer sign in, and introduce a new visitor.
- **Layout.** Desktop: split, left brand panel (logo, tagline, three short value lines: free, short lessons, captions), right sign in card. Mobile: logo, sign in card, links below. No video previews (data).
- **Components.** Email field, password field with visibility toggle, Sign in button (full width, primary), Forgot password link, Create account link, notice area (success, lock, errors).
- **Data.** Platform name, tagline, logo (from theme and config). Sign up open or invite only flag.
- **States.** Loading (button locks, spinner inline under 3 seconds). Error (generic wrong credentials, network). Locked (screen 7: message with minutes remaining, link to reset). Success redirect.
- **Responsive.** Card max width 400. Keyboard friendly inputs (`inputmode="email"`).
- **Navigation in.** `/`, deep link redirects, sign out, session expiry, verification success. **Out.** Profile picker, Sign up, Forgot password, Verify email (unverified).
- **Stories.** M01-S06, M01-S07, M01-S12, M01-S13, M29-S03.

### Screen 2. Sign up (`/sign-up`)

- **Purpose.** Create an account.
- **Layout.** Single column card: email, password with checklist (3 rules) and 4 segment strength meter, terms line, Create account button, Sign in link.
- **Components.** Password field (paste allowed), live checklist, meter, honeypot (hidden), optional invite code field, optional Turnstile.
- **Data.** Flags (open or invite only), legal page links.
- **States.** Validation lazy then eager. Network error keeps values. Rate limited message. Invite only variant.
- **Responsive.** Same on all widths, keyboard does not hide the submit button (sticky action row on xs).
- **Nav in.** Landing, Sign in. **Out.** Verify email.
- **Stories.** M01-S01, M01-S02, M01-S14, M26-S01, M29-S03.

### Screen 3. Verify email (`/verify-email`)

- **Purpose.** Confirm the email with a 6 digit code.
- **Layout.** Heading, text with masked email ("a***@gmail.com"), 6 slot code input, Verify button (auto submits when full), Resend with countdown, Change email link.
- **Components.** Code input, countdown button, change email dialog.
- **Data.** Masked email, resend state, attempts.
- **States.** Wrong code, expired code, too many wrong attempts, resend limit, provider failure.
- **Responsive.** Slots at least 44 px wide. Numeric keypad on phones.
- **Nav in.** Sign up, unverified sign in. **Out.** Profile picker. 
- **Stories.** M01-S03, M01-S05.

### Screen 4. Link confirmation result (`/verify-email/confirm`)

- **Purpose.** Show the result of tapping the email link.
- **Layout.** Centered card with result icon (text based), message, one button.
- **States.** Success, already used, expired or invalid (with Send a new email).
- **Nav in.** Email. **Out.** Sign in, Verify email.
- **Stories.** M01-S04.

### Screens 5 and 6. Forgot and Reset password

- **Purpose.** Recover access.
- **Layout (forgot).** Email field, Send link button, always the same confirmation text. **Layout (reset).** New password with checklist and meter, confirm via visibility toggle, Save button.
- **States.** Forgot: sent, rate limited. Reset: valid, invalid or expired link, success redirect with notice.
- **Nav in.** Sign in link, lockout email. **Out.** Sign in.
- **Stories.** M01-S08, M01-S09.

### Screen 8. Public title preview (`/title/[slug]` signed out)

- **Purpose.** Convert shared links into sign ups.
- **Layout.** Poster, title, description, categories, duration, CC badge, primary button "Sign in to watch", secondary "Create account".
- **Data.** Public title fields and Open Graph tags.
- **States.** 404 for hidden titles.
- **Nav in.** WhatsApp and search engines. **Out.** Sign in with `next`.
- **Stories.** M07-S06, M01-S13.

### Screen 9. Profile picker (`/profiles`)

- **Purpose.** Choose who is watching.
- **Layout.** Centered heading "Who is watching?", grid of avatar tiles (name below, Kids badge), Add profile tile, Manage profiles button below.
- **Components.** Avatar tile (focusable, 44 px minimum), badge, Add tile.
- **Data.** Profiles of the account, limit, last used.
- **States.** Loading (circle skeletons or cached), error (retry plus Sign out), single profile (auto skip), no profile (create first profile flow).
- **Responsive.** 2 columns xs, 3 sm, up to 5 across on desktop.
- **Nav in.** Sign in, header Switch profile, kids exit. **Out.** Home, Manage profiles, Create profile.
- **Stories.** M03-S01, M03-S11, M03-S13, M02-S07.

### Screens 10 to 12. Manage, Create and Edit profile, Delete confirm

- **Purpose.** Maintain profiles.
- **Layout.** Manage: same grid with pencil overlays and Done. Create or Edit: avatar preview, name field with counter, avatar grid, Kids profile switch with explanation, Language and Autoplay (edit only), Save and Cancel, Delete profile (edit only, danger style at bottom).
- **Components.** Avatar picker (radio group), switch, confirm dialog (names profile, states history and list will be deleted).
- **States.** Name duplicate, limit reached, last profile (Delete disabled with reason), last adult profile guard, unsaved changes prompt, kids to adult needs password.
- **Responsive.** Edit is a full page on mobile and a centered card on desktop.
- **Nav in.** Picker, header menu. **Out.** Picker, Home.
- **Stories.** M03-S02 to M03-S06, M03-S10, M35-S02.

### Screen 13. Kids exit password dialog

- **Purpose.** Leave kids mode or reach adult only pages.
- **Layout.** Modal with password field, Continue, Cancel.
- **States.** Wrong password, locked, offline.
- **Stories.** M35-S02, M35-S03.

### Screens 14 and 15. Home (`/`, signed in)

- **Purpose.** Discover and resume.
- **Layout regions.** Header, hero banner (poster art, scrim, title, one line description, Play or Resume, More info, rotation dots), rows (Continue Watching, My List, curated rows), footer.
- **Components.** Hero (still first, optional muted preview clip, dots with progress fill, Pause, arrows), row with arrows (desktop hover) and a View all link, title card (poster 16:9, title, duration, progress bar), hover card (mouse only, 300 ms), skeletons, inline row error.
- **Data.** Hero slots, rows and items from curation, personal rows, progress per item, kids filter.
- **States.** Loading (hero and 2 rows skeleton, others lazy), empty catalog ("New videos are on the way"), partial row failure, error card, offline banner with cached shell. Kids Home with larger cards and kid only content.
- **Responsive.** Rows peek next card. Mobile gets bottom tab bar. Hero becomes poster on top with text below on xs for legibility.
- **Nav in.** Picker, logo, tab bar. **Out.** Title detail, Series page, Watch (Continue Watching tap), Browse (See all), Search.
- **Stories.** M05-S01 to M05-S08, M09-S01, M10-S04, M17-S05, M35-S01, M41-S01 to M41-S15.

### Screen 16. Browse by category (`/browse`, `/browse/[slug]`)

List pages behind View all (M41-S09): `/browse/new` (newest first, Load more, length filter), `/browse/trending` (top 50 of the last 7 days in rank order), `/browse/series` (every live series) and `/browse/row/[slug]` (a manual section in the editor's order). They share the grid (2 across on phones, up to 6 from 1920 px), a loading skeleton with reserved height, an empty and an error state with Retry, and the not found page for an unknown slug. The words new, trending, series and row cannot be category slugs.

- **Purpose.** Explore by subject.
- **Layout.** Title and count, one category chip rail that never wraps (scroll snap, edge fades, arrows on fine pointers, selected chip scrolled into view), one bar with two menu buttons (Length and Sort, tinted when set, Clear link) pinned with the rail under the nav, grid of cards (2 columns xs, up to 5 xl) with "Show more". Mockup S186, decisions D-357.
- **States.** Loading skeleton grid that reserves height, empty category (Back to Home), no match after filters (Clear filters), Show more idle, loading and failed (Try again), offline. Each empty state has one action (R39).
- **Responsive.** The rail scrolls on every width. Length and Sort open a popover menu on desktop and a bottom sheet on phones, applied on tap with no Apply bar. On phones the bar slides away on scroll down and returns on scroll up (not under reduced motion animation), the rail stays.
- **Nav in.** Header, tab bar, See all. **Out.** Title detail, Series page.
- **Stories.** M06-S01, M06-S02, M04-S04.

### Screen 17. Search (`/search`)

- **Purpose.** Find by typing.
- **Layout.** Search field at top (full screen on mobile, Cancel), recent searches or popular categories when empty, results grid with count, Show more.
- **States.** Empty query, typing (thin progress line), no results (tips plus popular titles), error ("Search is unavailable"), rate limited ("Slow down a little").
- **Voice search.** A mic button inside the field, hidden on kids profiles, under Data saver and in browsers without speech recognition.
- **Storage notice.** A dismissible notice on every public page except Watch (informational, Got it and Privacy link), above the tab bar on phones. Placement rules in DESIGN-SYSTEM 11.13.
- **Nav in.** Header icon, `/` key. **Out.** Title detail, Series page, Browse.
- **Stories.** M06-S03 to M06-S10.

### Screen 18. Title detail (`/title/[slug]`)

- **Purpose.** Decide and start.
- **Layout.** Poster or hero (16:9), title, meta row (duration, categories, CC badge), primary Play or Resume (with remaining time), secondary Start over, My List toggle, Share, description (collapsible), progress bar, "More like this" row.
- **States.** Loading skeleton, not found (404), kids blocked ("not available on this profile"), error.
- **Responsive.** Two column on desktop (poster left, text right). Single column on mobile with sticky Play bar.
- **Nav in.** Cards, search, shared links. **Out.** Watch, series page (if episode), Browse by category.
- **Stories.** M07-S01, M07-S03, M07-S04, M07-S05, M10-S01, M35-S01.

### Screen 19. Series page (`/series/[slug]`)

- **Purpose.** See and play episodes in order.
- **Words (M51).** Group and item words, counts and codes come from the series labels (Season and Episode by default, or the owner's words); a group with its own title shows it. The main button and a phone sticky Play bar follow account progress, or device progress for a guest. A guest in Kids mode sees the Kids blocked screen when the series is not in the Kids library.
- **Layout.** Series header (poster, title, description, primary Play or Resume S1 E3, My List, Share), group selector in the owner's word (hidden for one group), item list (number, thumbnail, title, duration, snippet, progress or watched tick).
- **States.** Loading, one season, unpublished episodes hidden, error, offline.
- **Nav in.** Cards, Continue Watching, end screen. **Out.** Watch.
- **Stories.** M07-S02, M07-S07, M09-S05, M09-S09, M10-S05.

### Screen 20. My List (`/my-list`)

- **Purpose.** Return to saved titles.
- **Layout.** Heading with count, grid newest added first, remove action per card (menu), Show more.
- **States.** Empty ("Your list is empty" with Browse button), loading, error, hidden unpublished titles, undo toast.
- **Stories.** M10-S01 to M10-S06.

### Screens 21 and 22. Watch (`/watch/[videoId]`) desktop and mobile

- **Purpose.** Play.
- **Layout (desktop).** Dark player 16:9 on the off-white page, title row under it with My List and Share, description, caption badge, right column of pastel Up next tiles. **Layout (mobile portrait).** Full width player at top, title and actions, Up next list below. **Landscape.** Player fills the screen.
- **Components.** Player (Video.js v10 with hls.js), poster, controls (play, seek, time, volume on desktop, captions, speed, quality, PiP, full screen), toast for "Resumed from 2:14. Start over", Up next tile, error overlay.
- **Data.** Signed playlist URL, key, caption tracks (approved), saved position, profile settings, next episode or related, metadata.
- **States.** Loading (poster and shell), buffering, error overlays, offline, session expired, video removed, kids blocked.
- **Nav in.** Cards, Continue Watching, series episodes, shared links. **Out.** Back to title or series, next episode, End screen, Home.
- **Stories.** M08-S01 to M08-S31, M09-S04, M11-S01 to M11-S07.

### Screen 23. Player menus

- **Purpose.** Speed, quality, captions and Data saver controls.
- **Layout.** Desktop: popover above the control bar with sections. Mobile: bottom sheet with the same options and 44 px rows.
- **States.** Quality items disabled with hint when Data saver is on, caption menu empty (hidden), selected state with check and `aria-checked`.
- **Stories.** M08-S10, M08-S11, M08-S12, M25-S03.

### Screen 24. Player error and network states

- **Purpose.** Recover without losing place.
- **Variants.** Buffering spinner, "Slow connection. Switching to lower quality", "Connection lost" with Retry, "You are offline", "Sign in again to keep watching", "This video is no longer available", "This video cannot play on this device", "Captions could not load" toast.
- **Stories.** M08-S17, M08-S20 to M08-S24, M01-S12.

### Screen 25. End screen and Up next

- **Purpose.** Keep the learner moving.
- **Layout.** Overlay on the player: Up next card (poster, title, 5 second countdown ring, Play now, Cancel), or Replay, Add to My List and related row.
- **States.** Autoplay on, autoplay off, last episode ("You finished <series>"), standalone, no next title.
- **Stories.** M08-S13, M08-S14, M08-S28.

### Screen 26. Shortcuts help dialog

- **Purpose.** Show keyboard shortcuts.
- **Layout.** Modal list of keys and actions, Escape to close.
- **Stories.** M08-S08.

### Screens 27 to 30. Account area

- **Purpose.** Manage account and settings.
- **Layout.** Left list on desktop (Overview, Security, Playback, Data and privacy), segmented list on mobile. Overview: email with verified state, member since, profiles count. Security: change password (checklist), change email, sessions list with Revoke and Sign out everywhere. Playback: autoplay, Data saver, captions default, caption style, language. Data and privacy: Export data, Delete account (danger section with typed confirmation).
- **States.** Saving (optimistic with rollback), wrong password, locked, export pending, deletion pending with Cancel, kids profile gate.
- **Nav in.** Header menu. **Out.** Picker, Home.
- **Stories.** M02-S01 to M02-S06, M01-S11, M03-S09, M11-S03, M25-S03, M26-S05.

### Screen 31. Legal, About, Help

- **Purpose.** Trust and support.
- **Layout.** Readable column (max 70 characters), heading, last updated, table of contents, content from admin pages editor. Draft marker for placeholder text.
- **Stories.** M26-S01 to M26-S03.

### Screens 32 to 37. System pages

- **404.** Message, one action (Back to Home), a search field and popular titles, header kept. HTTP 404 and `noindex`. Removed video and series pages follow the same pattern.
- **Server error.** Plain words, one action (Try again), reference id and support email as plain text, no Report link.
- **Offline.** "You are offline", Reload the page. One action (R39).
- **Maintenance.** Message and expected time.
- **Unsupported browser.** List of supported browsers.
- **Install banner.** Slim banner with Install and Not now, iOS instruction sheet.
- **Stories.** M26-S04, M25-S01, M25-S04, M25-S07, M29-S04.

### Screen 38. Admin login (`/admin/login`)

- **Purpose.** Secure admin entry.
- **Layout.** Centered card on dark background, email, password, Continue. Distinct look from viewer sign in (dark, "Admin" label).
- **States.** Wrong credentials (generic), locked 30 minutes, network error.
- **Nav out.** 2FA.
- **Stories.** M12-S01.

### Screen 39. Admin two factor

- **Layout.** Code entry (6 slots) or enrolment (QR code, manual key, code), then recovery codes with Copy, Download and confirm checkbox.
- **States.** Wrong code, locked, recovery code use.
- **Stories.** M12-S02, M12-S03.

### Screen 40. Accept invite

- **Layout.** Role summary, set password with checklist, then 2FA enrolment.
- **States.** Expired or used invite.
- **Stories.** M12-S05.

### Screen 41. No access

- **Layout.** Admin shell with message "You do not have access to this page", link to Dashboard.
- **Stories.** M12-S04.

### Screen 42. Dashboard (`/admin`)

- **Purpose.** What needs attention.
- **Layout.** Tiles (published, drafts, processing, failed), Needs attention list (failed encodes, captions to review, scheduled today), recent uploads, storage used, 7 day views chart.
- **States.** Per tile loading and error, empty ("Start here" three steps), role limited tiles.
- **Nav out.** Filtered Videos, Encoding, Captions, Analytics.
- **Stories.** M16-S11, M22-S03, M21-S03.

### Screen 43. Videos list (`/admin/videos`)

- **Layout.** Page header with Upload button, filter bar (search, status, category, captions, suitability), table (thumbnail, title, status badge, duration, categories, captions state, published date, row actions), bulk bar on selection, cursor pagination footer.
- **States.** Skeleton rows, empty ("Upload your first video"), no match, error, bulk progress and partial failure summary.
- **Responsive.** Cards on mobile.
- **Stories.** M16-S01, M16-S09, M35-S04.

### Screen 44. Upload (`/admin/videos/upload`)

- **Purpose.** Get videos into R2 reliably.
- **Layout.** Drop zone (default, drag over with border change, tint and "Release to upload"), settings (parallel uploads), queue list of rows (name, size, status, percent bar, speed, ETA, Pause, Cancel), completion preview cards (thumbnail or icon, type and size, "Uploaded just now", Replace, Remove, Edit details), global progress chip in top bar.
- **States.** Row: waiting, uploading, paused, failed at 90 percent with inline Retry, validating, processing, done, rejected file. Page: empty queue, leave warning, offline.
- **Stories.** M13-S01 to M13-S12, M14-S01.

### Screen 45. Video edit and status (`/admin/videos/[id]`)

- **Layout.** Left: form card (title, description with counters, categories multi select, tags, suitability, series and episode). Right: status checklist card (Uploaded, Encoded, Poster, Captions approved, Details, Suitability), live preview of the card, Publish button (state driven), Preview as viewer, Delete.
- **States.** Unsaved changes, validation errors, processing (read only parts), failed encode with Retry.
- **Stories.** M16-S02, M16-S07, M16-S08, M28-S05.

### Screen 46. Poster picker and crop

- **Layout.** Candidate grid (6), Upload own, crop with focus point and safe area overlay, hero crop preview.
- **Stories.** M16-S03, M36-S01 to M36-S03.

### Screen 47. Publish and schedule dialog

- **Layout.** Radio: Publish now or Schedule, date and time pickers with time zone label (Africa/Lagos), checklist recap, caption override section (Admin only, reason required), Confirm.
- **States.** Checklist failure (disabled), past time error.
- **Stories.** M28-S01 to M28-S05, M15-S10.

### Screen 48. Encoding queue (`/admin/encoding`)

- **Layout.** Table of jobs with stage, percent bar, ETA, status badge, actions. Filters. Live update.
- **States.** Live updates paused banner, failed with plain reason panel, empty.
- **Stories.** M14-S05, M14-S06, M14-S09.

### Screen 49. Caption list (`/admin/captions`)

- **Layout.** Table of videos with caption state, language, cue count, last edited, filter by state, oldest first.
- **States.** Empty ("No captions waiting"), error.
- **Stories.** M15-S03.

### Screen 50. Caption review (`/admin/captions/[videoId]`)

- **Layout.** Desktop: video with overlay on the left, cue list on the right (index, start, end, text, warnings), toolbar (Find and replace, Undo and Redo, Regenerate, Download, Upload, Approve). Mobile: sticky video on top, cue list below.
- **Components.** Cue editor (text, time fields), split and merge, current cue highlight and autoscroll, validation chips (overlap, too long, empty), autosave indicator.
- **States.** Generating (progress), needs review, approved (with approver and time), failed, saving error with Retry, unapproved edits after approval.
- **Stories.** M15-S01 to M15-S09.

### Screens 51 and 52. Series list and edit

- **Layout.** List: table with poster, title, item count in the series words, status. Edit: details form, Names section (site names or this series only), items grouped under group headings with a title field, Up and Down buttons, group and number fields, Add item, and a Check the numbers warning for gaps and duplicates. The Videos list has an Add to series bulk action with a preview dialog.
- **States.** Gap or duplicate number, empty, error, name field errors.
- **Stories.** M16-S04, M28-S06, M51-S01 to M51-S05.

### Screen 53. Categories

- **Layout.** List with drag handles and Up and Down buttons, rename inline, hide toggle, Delete with reassign dialog, Add category row.
- **Stories.** M16-S05.

### Screen 54. Trash

- **Layout.** Table with deleted date and days left, Restore and Delete forever (Super admin).
- **Stories.** M16-S06.

### Screen 55. Home curation (`/admin/home`)

- **Layout.** Left: hero slots (up to 5, each with Headline, Description and Button label and a clip chip) and the sections list (inline rename, drag and keyboard reorder, visibility toggle, type, View all setting, minimum titles, kids visible, Add section, Restore launch defaults). Selecting a section opens its editor (type, name, View all field, title list). The video editor has a Home preview card (Automatic, Pick a segment, Off, Retry). Right: live preview with desktop and mobile toggle and kids toggle. Toolbar: Unsaved changes, Save draft, Publish changes, Restore previous.
- **States.** Skipped unpublished titles (warning icon), section limit reached, save error with Retry, invalid name or custom link, preview failure, empty ("No sections yet").
- **Stories.** M17-S01 to M17-S07, M05-S05, M41-S04, M41-S06 to M41-S08, M41-S13, M41-S16, M41-S17, M41-S20.

### Screens 56 and 57. Theme settings and history

- **Layout.** Left: controls grouped in cards (Colours, Fonts, Sizes, Logo and name). Right: live preview tabs (Home, Watch, Sign in) and device toggle. Toolbar: Reset to default, Save draft, Publish theme. History drawer with swatch strips and Restore.
- **Components.** Colour field (picker and hex), contrast badge per pair (ratio, pass or fail), font select with preview, slider.
- **States.** Contrast warning, blocked save below 2 to 1, invalid hex, publish success, fallback to default.
- **Stories.** M18-S01 to M18-S09.

### Screens 58 and 59. Users list and detail

- **Layout.** List: search, status filter, table (email masked by role, status, created, last active, profiles). Detail: status card, profiles list, sessions count, support actions with confirm dialogs and reason field.
- **States.** No match, restricted fields for Analyst or Editor.
- **Stories.** M27-S01 to M27-S04.

### Screens 60 and 61. Analytics overview and per video

- **Layout.** Range picker, tiles (views, unique viewers, watch time, completion), trend chart, top titles table, device and country splits, Export CSV. Per video: daily views chart, retention curve, summary.
- **Components.** Chart with table toggle and text alternative.
- **States.** No data, per tile error, grouped Other for small groups, export in progress.
- **Stories.** M19-S02 to M19-S05.

### Screen 62. Audit log

- **Layout.** Filters (actor, action, target, date), table (time, actor, action, target, summary), detail drawer with before and after diff, Export.
- **States.** No match, error, restricted by role.
- **Stories.** M20-S02, M20-S03.

### Screen 63. Roles and invites

- **Layout.** Admins table (name, email, role, 2FA, last sign in, actions), Invite admin form (email, role), pending invites list, read only permission matrix with plain language descriptions.
- **States.** Last Super admin guard, invite expired, no access for others.
- **Stories.** M12-S05 to M12-S07.

### Screen 64. Site settings

- **Layout.** Tabs: Platform details, Features and limits (Super admin), Home, Series names (M51: name set, custom words, item code, live preview), Discovery, Pages (editor with versions), Invite codes, Maintenance. Launch checklist panel showing unset items.
- **States.** Unsaved changes, validation, placeholder warnings.
- **Stories.** M29-S01 to M29-S04, M26-S02, M51-S01.

### Screen 65. System

- **Layout.** Tabs: Jobs (dead and failed, Retry, Discard), Storage (usage by type), Player quality (p50 and p75 startup, rebuffer ratio, errors).
- **Stories.** M30-S03, M22-S03, M24-S04.

### Screen 66. My admin account

- **Layout.** Change password, 2FA and recovery codes, active admin sessions, notification preferences.
- **Stories.** M12-S09, M21-S05.

### Screens 80 to 89. Guest access (M40)

A visitor without an account uses the same screens as a viewer, with the differences below. Mockups are drawn by lane L1 as S80 to S89.

- **S80 Home for guests.** Hero and rows with no sign in card. A Continue learning row from this device sits first below the hero and shows only when it has something. No banner, popup or sticky sign up bar. Stories M40-S01, M40-S14.
- **S81 Signed out header and menu.** Logo, Home, Browse, My List, search, Sign in and Create account (hidden when sign up is closed) from 960 px. On phones the same bar as a signed in viewer without the bell: logo, search and a person icon that opens the account sheet with Sign in, Create account, a Kids mode switch with its help line and Help (S183 frames 1 and 7). A Primary tab bar on phones, hidden on a title page and on Watch. Over the hero the bar has a dark scrim that holds through the whole bar. In Kids mode the header shows the logo mark, a Kids badge, search and the account icon, and the sheet shows only the Kids mode switch and Help (S183 frame 4). A Turn off Kids mode button sits above the footer. Stories M40-S06, M40-S09, M47-S17, M47-S18.
- **S182 Phone header options.** Three directions for the crowded phone header; option B (logo, search, one account icon with a sheet) is built, D-356 and D-374.
- **S183 Phone header, all states.** Guest, signed in, Kids profile, Kids mode, scrolled solid, the account and profile sheets, search, tab bar states, control states and a pale poster contrast check. Stories M47-S17, M47-S18.
- **S184 Phone header width stress.** 320, 360 and 414 px with long Yoruba, Igbo and Hausa labels. Built as a Chromium test in `packages/ui/test/topnav-width.test.ts`. Story M47-S19.
- **S185 Landscape and Watch.** A 48 px header and a 44 px tab bar on a phone on its side, and no header or tab bar on Watch.
- **S82 Title and series page for guests.** The full title page with Play (or Resume from this device with Start over, or Watch again). My List opens S83. A series page marks watched episodes from this device. Kids mode block screen: "This video is not in Kids mode" with Browse and Turn off Kids mode. With guest play off the page shows the preview and Sign in to watch. Stories M40-S05, M40-S09, M07-S06.
- **S83 Sign in to save dialog.** A modal (a bottom sheet on phones) with Not now, Create account and Sign in, with the page to return to in `next`. Copy for My List and for a like. Stories M40-S07, M40-S15.
- **S84 My List explainer.** Why My List needs an account, Sign in, Create account and Browse. In Kids mode only a note for a grown-up. Story M40-S08.
- **S85 Watch page for guests.** The watch page with My List opening S83 and no Sign in button on the phone. Progress is written to this device and a quiet note says when it cannot be. Stories M40-S02, M40-S04.
- **S86 Guest Kids mode.** The Menu switch, Home and Browse filtered to kids titles, the blocked direct link. Story M40-S09.
- **S87 Limit and challenge states.** The wait message for a limit, and the "One quick check" dialog with the Turnstile widget and a single Cancel action. Not shown on a Kids playback page. Stories M40-S11, M40-S12.
- **S88 Import device history prompt.** After sign in, a dialog "Add what you watched here?" with Not now and Add to my history, then a toast with the count. Never for a kids profile. Story M40-S13.
- **S89 Device storage and privacy.** The note "Your place is not being saved on this device", and the Privacy page text for the guest cookie and the anonymous daily id. Clear history on this device (M40-S18) is not built yet. Stories M40-S16, M40-S18.

### Screens 140 to 149. Languages (M46)

Mockups are in `docs/mockups/v2` as S140 to S149, reviewed in `docs/reviews/v2/L7-review.md`.

- **S140 Language picker, phone.** A bottom sheet opened from the account menu, the guest menu and the footer. Rows show the endonym with the English name beneath, the current one marked, 44px high. The picker is hidden with only English enabled and for kids profiles. A line "Some text is still in English" shows for a language below 100 percent. Below 240px the label folds into the icon. Stories M46-S01, M46-S03.
- **S141 Language picker, desktop.** A globe button in the header opens a menu with arrow key navigation, a footer link, and no control on a kids profile. Hover rules sit inside the fine pointer media query. Stories M46-S01, M46-S04.
- **S142 Language settings.** The settings hub language row and the profile form interface language and caption language selects, disabled for a kids profile, the caption language following the interface language until changed. Stories M46-S01, M03-S09.
- **S143 Admin Languages.** `/admin/languages` table (cards on phones): state, approved percent, missing, stale, in review, last change, a Live switch with the threshold reason, Super admin Publish anyway with a reason, export links, and the Engine panel with provider, state and monthly use against the cap. Empty: "Only English is set up." Stories M46-S06, M46-S17.
- **S144 Translate workspace.** `/admin/languages/[locale]` with tabs Missing, Stale, In review, Approved, All and Viewer hits, search, area filter, rows with placeholder chips and the plural forms of the language, Copy English, validation under the field, Save, and a bulk approve bar with count and warning. Sample draft button where a draft exists. Stories M46-S07, M46-S09, M46-S10.
- **S145 Import and export.** Export CSV and JSON, an import dialog with a dry run table (added, changed, unchanged, rejected with reasons) before confirm, size limit and network failure states. Imports land In review. Story M46-S08.
- **S146 Missing key report.** The Viewer hits tab sorted by hits, with last seen and a link to the row. Story M46-S10.
- **S147 Captions list with languages.** Language chips with state, language and state filters, bulk approve, bulk publish and bulk translate dialogs, partial failure summary. Stories M46-S11, M46-S13, M46-S16.
- **S148 Caption review in translation mode.** Language tabs, the English cue beside the translated cue, timing locked until Unlock timing, the Publish switch (disabled until approved), Source changed banner with Retranslate, Add translation dialog with an estimate and a provider not configured state. Stories M46-S11, M46-S12, M46-S13.
- **S149 Player caption languages.** The caption menu with Off first, each language by its own name with its own `lang`, a toggle only for one language, the default chosen by profile language then interface language then English, and the English fallback toast. Story M46-S14.

### Screens 170 to 179. Account security, activity and reach (M49)
- **S170 Security overview.** Two step verification card, connected sign in card (Google), devices with Sign out everywhere, and sign in history. Route `/account/security`. Stories M49-S01 to S03, S05, S12, S13.
- **S171 Turn on two step verification.** QR code with manual key, code confirm, recovery codes with the "I saved these codes" gate.
- **S172 Sign in challenge.** `/sign-in/verify` with the code, recovery code entry and lost phone help.
- **S173 Google sign in.** The Google button on Sign in and Sign up, `/sign-in/link-google` (password confirmation), `/sign-in/google-failed`, `/sign-up/google` (finish sign up). Absent without keys.
- **S174 Viewing activity.** `/account/activity`, grouped list, Remove with Undo, Clear all dialog, empty, profile tabs, Kids password gate. Story M49-S09.
- **S175 Playback settings.** Caption size, background, edge, colour, contrast, live preview, Reset to defaults, This device TV mode, Data saver device note.
- **S176 Sign out everywhere.** Dialog with password, device rows with icons, This device badge.
- **S177 TV mode.** `/tv` and `html[data-tv]`: large type, thick focus ring, row scrolling. The player keys are owned by L4.
- **S178 Offline downloads.** Not now.
- **S179 Passkeys.** Not now.

### Admin help centre routes (M50, placeholder)

Planned in `docs/plan/v2/L14-admin-knowledge-base.md`, mockups in `docs/mockups/v2/L14`. Staff only, minimum role Editor, not indexed.

| Route | Screen |
|---|---|
| `/admin/help` | Help home: search, Start here, seven paths, core tasks, reference |
| `/admin/help/path/[path]` | One learning path in order |
| `/admin/help/[id]` | One article with video, steps and pictures |
| `/admin/help/search` | Search results |
| `/admin/help/videos/[id]` | Video page: player, transcript and the playlist of the path (no autoplay) |
| `/admin/help/search` | Search results with marked words, role labels, empty state and a suggestion (GET form, works without script) |
| `/admin/help/glossary` | Words explained: A to Z jump bar, filter, anchors by term, links to guides |
| `/admin/help/media/[...path]` | Private video, caption and picture route (not a page). `img/...` pictures, `video/<id>/<file>` videos with Range |

Entry points: a Help button in the top bar (drawer at md and up, bottom sheet on phones), a Help link in each page header, a Help item in the side menu.

## 7. Key flows (for navigation checking)

1. **New viewer.** Landing, Sign up, Verify email, Profile picker (create first profile), Home, Title detail, Watch.
2. **Returning viewer.** Sign in, Profile picker (or auto), Home, Continue Watching, Watch (resumes).
3. **Shared link.** Public title preview, Sign in, Profile picker, Title detail, Watch.
4. **Kid.** Profile picker, Kids Home, Watch, Exit kids mode (password).
5. **Admin publish.** Admin login, 2FA, Dashboard, Upload, Encoding queue, Caption review (approve), Video edit (checklist), Publish dialog, Home curation.
6. **Recover.** Sign in (locked), Forgot password, Reset password, Sign in.
7. **Guest.** Home, Title detail, Watch (progress kept on the device), My List opens the Sign in to save dialog, Sign in, Profile picker, the save is applied, Import prompt.

## 8. Story coverage check

Every module with a user interface has at least one screen. Modules without their own screens: M04 (data), M14 (shown on screens 44 and 48), M22 and M31 (infrastructure, shown on screen 65), M23, M24 (screen 65), M30 (screen 65), M33. Screen 24 and 25 together cover the player edge cases in M08. Any new story in `docs/USER-STORIES.md` must be added to a screen here in the same change.
