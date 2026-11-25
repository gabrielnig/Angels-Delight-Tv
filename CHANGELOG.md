# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Lane KB-H slice 9 (M50): harness docs. Story M50-S30, the module note, recording rules in SECURITY section 19, the spike marked superseded and the harness section of the lane note finished.
- Lane KB-H slice 8 (M50): fact checker. `pnpm kb:fact-check` re-runs a help article from only its step list and role on a clean demo stack and reports the first step that cannot be followed, with the labels on screen. Steps that need a file are skipped as manual.
- Lane KB-H slice 7 (M50): episode coverage tests. Every admin route, menu item, permission action, setting and status needs an episode or an entry on the known gaps list (`scripts/kb-recorder/coverage-gaps.json`), failing with a named list. The list can only shrink.
- Lane KB-H slice 6 (M50): CI for the knowledge base. `kb-verify.yml` checks only the affected episodes on pull requests that touch admin files, `kb-nightly.yml` records everything and compares lengths and screenshots, with a screenshot diff (`pnpm kb:shots-diff`), `pnpm kb:update`, `pnpm kb:steps`, `pnpm kb:publish`, a `kb-stack.sh start` mode and exit codes that separate content failures from infrastructure failures. No secrets.
- Lane KB-H slice 5 (M50): pipeline commands for the knowledge base recorder. `pnpm kb:record` with `--episode`, `--path`, `--changed` and `--all`, `pnpm kb:verify` as a locator only check, an output layout per episode and profile, a poster and a 480p copy, ffprobe checks (codec, no audio, size, length), atomic replacement of published files, and `manifest.json` for the platform.
- Lane L14 platform slice 4 (M50): private help media route for videos, captions and pictures (staff only, Range, no catalog), the silent captioned `HelpVideo` player with quality and phone picture choice, transcript and watched at 90 percent, and the video page with the path playlist.
- Lane L14 platform slice 3 (M50): migration 0060 `help_progress` (per account, owner only RLS, deleted at purge, in the data export), Mark as done by button, a one tap Was this helpful answer and a Your progress card on the help home.
- Lane KB-H slice 4 (M50): caption tools for the knowledge base recorder. Caption style guide lint (short plain sentences, no dashes or emojis, 15 characters a second, two lines of 42), burn in with a readable large style, a Step n of N badge, title and end cards, skipped long waits, WebVTT, a transcript with pointer descriptions and a chapters track.
- Lane KB-H slice 3 (M50): redaction scanner for knowledge base captures (real looking emails, keys, tokens, phone numbers and IP addresses fail the capture with a masked report), annotation tools (numbered circles, optional arrows, blur, card crops), and WebP screenshots at desktop 1280 and phone 390 under 120 KB with no metadata.
- Lane L14 platform slice 2 (M50): `/admin/help` home with Start here and learning paths, path pages, article pages with Who can do this from the permission table, contents list, print layout and role labels, a Help centre item in the side menu, a Help button in the top bar and a Help link in every page header, higher role guides hidden behind a count, the `help.support_contact` setting, a private picture route and coverage tests with a gap list.
- Lane L14 platform slice 1 (M50): `@ad/help` reads Markdown help articles with a strict front matter schema, a safe Markdown subset parser, a library with link, route and path checks, a glossary parser, a copy lint and `pnpm help:check`; three sample articles (S04, D02, D07) with placeholder media; M50 stories S25 to S29 and decisions D-376 and D-377.
- Lane L13 slice 4 (M51 docs): stories M51-S01 to S07, MODULES, SCREEN-ARCHITECTURE, DATA-MODEL, SECURITY 12b and CLIENT-INPUTS for the configurable series names.
- Lane KB-P slice 5 (M50): help search and glossary. A scorer in `@ad/help` with plain word aliases, plural stemming, one letter typo tolerance, Did you mean and highlights, `/admin/help/search`, `/admin/help/glossary`, and a search box on the help home. Higher role guides stay in results with a label.
- Lane KB-H slice 2 (M50): demo stack for the knowledge base recorder. A clearly fake dataset (Demo names, test sponsors and donations, one video per status, a Part and Lesson series, example domains only) over the fixture build with `KB_DEMO=on`, a frozen server and browser clock, a local only reset route called before every episode, an origin and database guard, and `pnpm kb:stack` (fixture and real Postgres modes).
- Lane KB-H slice 1 (M50): episode framework for the admin knowledge base recorder. One typed module per procedure gives the video, the screenshots and the article steps block, with helpers (sign in as a role, go to screen, click by accessible name, type, select, wait for a message, scroll, highlight, zoom), a caption safe area so captions never cover the target, and `docs/lanes/L14-build.md` (how to write an episode).
- Lane L13 slice 3 (M51): a guest's series button and a new sticky Play bar on the series page follow what this device has watched (Resume, Play next, Watch again, with the owner's item code); the title page sticky bar follows device progress for guests too; guests in Kids mode see the Kids blocked screen on a series that is not in the Kids library.
- Lane L13 slice 2 (M51): Add to series on the Videos list (choose or create a series, group, numbering by order picked, title or upload date, preview, undo), Up and Down buttons, group titles and gap and duplicate warnings in the series editor, audit entries `series.episode_move` and `series.group_rename`. Fixed the series editor save dropping rating and names.
- Lane L13 series with your own names (M51, slice 1): the owner words the groups and items of a series (Season and Episode by default, or Book and Chapter, Part and Lesson, Module and Lesson, or four custom words plus an item code such as Ch). Site default under Site settings, Series names (`content.series_labels`), optional override per series in the series editor (migration 0059, `series.label_overrides`). One helper (`@ad/shared/series-labels`) words series pages, cards, Continue Next code, titles, activity, markers, admin screens and messages; `scripts/series-copy-scan.test.ts` fails on any hardcoded Season or Episode copy. Defaults unchanged. Player shortcut, autoplay and notification lines now say video (D-370).
- Lane L12 mobile header mockups (S182 to S185): four options for the crowded phone header, the recommended option in every state, a 320, 360 and 414 width stress test with Yoruba, Igbo and Hausa labels, and landscape plus the watch page exception, with the design system review
- Lane L14 plan (M50, docs only): the admin help centre at `/admin/help` with 83 articles, 73 silent captioned videos and about 500 screenshots, how it is recorded, kept fresh and handed over. Nothing is built yet. See `docs/plan/v2/L14-admin-knowledge-base.md`.
- Lane L9 donations and giving (M48): the Donate page, Paystack hosted checkout, thank you and cancelled pages, emailed receipts, the admin donations list with CSV export and audited review resolution, the transparency page, and the hardening tests (kids matrix, authorization rows, unchanged CSP, log redaction of Paystack keys). Everything is off by default and never shows to kids. Monthly giving is not built.
- Lane L9 donations backbone (M48): donations and payment event tables, a signed and idempotent Paystack webhook, an event processor that confirms every payment with Paystack, and worker jobs that settle stuck payments, mark old ones abandoned and prune old payloads. Off until a Paystack key is set. Also wires the sponsor reach prune job into the worker.
- Lane L9 payments core (M48): `@ad/payments` with a Paystack adapter (hosted redirect only), webhook signature check, money and reference helpers and an in memory fake Paystack for tests. Nothing calls it yet.
- Lane L9 sponsor report (M48): per sponsor impressions, clicks, click rate and daily reach for any range up to 400 days, with an admin only CSV download and a print page.
- Lane L9 sponsor placements (M48): labelled sponsor card on Home, title pages and around the player, with a skippable card before a video, frequency caps in a cookie, viewable impression counting and staff clicks left out of reports. Off until the master switch is on, never shown to kids.
- Lane L6 search core (M45-S07 to S09): migration 0043 (`search_terms`, `search_synonyms`, `search_misses`), typo correction with a word list, synonym groups with a cap of 8 and exact matches first, subjects, anonymous misses with 90 day pruning, exact matching for short words.
- Lane L6 share menu (M45-S06): `ShareMenu` with native share, Copy link, and admin chosen WhatsApp, Facebook, X and Email links, hidden for kids, bottom sheet under 600 px, literal `share.*` messages.
- Lane L6 Discovery tab (M45-S05): settings `seo.*` and `consent.*`, a live search result and share card preview with a 160 character counter, share channel switches, storage notice text and version bump, root metadata that follows the settings, robots.txt and noindex that follow the indexing switch and close staging.
- Lane L9 sponsors admin (M48-S01, S02): Sponsors pages to add sponsors, creatives with pictures and placements, approve, pause, archive and delete, and an off by default master switch that asks for the password.
- Lane L6 share images (M45-S03): `/og/title/<slug>` and `/og/series/<slug>` draw a 1200 by 630 jpeg under 300 KB from the poster with a four stop scrim (white text keeps 4.5 to 1 on a white poster), 404 for unpublished titles, default image fallback; `previewMetadata` takes `shareImagePath` and sets `og:locale`.
- Lane L6 structured data (M45-S02): `VideoObject`, `TVSeries`, `BreadcrumbList`, `WebSite` with a search action and `Organization` as escaped JSON-LD on title, series, category and guest Home pages; kids only titles carry `noindex` and no structured data (R26); `isKidsOnlyTitle` in `@ad/catalog`.
- Lane L6 sitemap (M45-S01): `/sitemap.xml` and `/sitemaps/<n>.xml` route handlers over `listSitemapRows` (published titles, series, categories, real lastmod, kids only titles left out), the Sitemap line in robots.txt, 503 with Retry-After on failure.
- Lane L8 design system tuning (M47): fractional row columns that follow the row container, one gutter clamp, mobile first type scale, 250 ms hover and 0 ms press tokens, button size tokens with a 44px hit area, a 1.25 hover card with an enter only delay, a nav that turns solid from a sentinel with a linear fade, a hero with a 10 s rotation and crossfade, skeletons that match real cards, vietnamese font subsets and an Inter fallback, and guard tests for hover, focus, touch targets, reduced motion, copy, fonts and decision ids.
- Lane K1 viewer integration: real catalog, library, profiles, account stats, playback settings, data export, theme, analytics identity and `/api/progress` sink wired into `apps/web`, with fixtures kept behind `VIEWER_FIXTURES=on`, migration 0014 and a real services Playwright smoke.
- Lane B auth: `@ad/auth` (Argon2id passwords, opaque sessions, per account keys with crypto-shredding, sign up and verification, sign in, reset, account changes and deletion, staff TOTP two factor, recovery codes, invites, role changes, `db:seed:admin`), `@ad/security` (rate limiter, lockouts, CSRF, CSP, audit writer), `@ad/mailer` (SMTP and templates), the nonce CSP `proxy.ts`, and the real auth gateway behind the viewer and admin screens.
- Lane C viewer API: `@ad/catalog` and `@ad/viewer` services (profiles, kids mode, home, browse, search, title detail, Continue Watching, My List, publishing), `/api/*` viewer routes, and `pnpm db:seed:demo`.
- Lane A foundation: pnpm workspace with `apps/web` (Next.js, `/api/health`), `apps/worker` (pg-boss boot) and packages `db`, `config`, `storage`, `ui`, `shared`.
- Drizzle schema for every DATA-MODEL table, generated migrations, and hand-written SQL for deferrable constraints, triggers, row level security on accounts, profiles, watch_progress and my_list, and role grants. `withAccount` sets the row level security context.
- Zod env loaders that fail fast, `.env.example` with a test that keeps it complete.
- Storage adapter with local and S3 drivers, signed local URLs, multipart planning and a shared contract suite.
- Design tokens and a validated theme variable helper in `@ad/ui`.
- ESLint (console banned in apps, import boundaries), Prettier, Vitest projects with `test:file` scripts, Playwright stub, `scripts/footprint-check.sh` and a pre-commit hook installer.
- `docker-compose.yml`, Dockerfiles for web and worker, and a CI workflow running lint, typecheck and changed tests only.
- Engineering documentation: architecture, data model, security, TDD protocol, testing strategy, developer setup and deployment guides.
- Changelog and lessons log.

### Changed
- DATA-MODEL: `videos` ready check now requires a non null duration. Upload defaults follow D-006 (8 MiB parts, 5 GiB). DEV-SETUP, ARCHITECTURE layout and env docs match the built repo.

### Lane I: analytics, PWA and observability

- Add `@ad/analytics`, `@ad/audit`, the PWA (manifest, service worker, install prompt, offline page), Data saver helpers, responsive posters, request ids, error reporter, `/api/ready`, `/api/analytics`, web vitals and the error page. Migration 0008. Decisions D-035 to D-041.

### Lane H: site settings and theme

- Add S64 site settings: platform details, features and limits, legal and info pages editor with versions, maintenance mode, launch checklist.

- Lane H: add `getRootTheme` helper for the root layout and docs/lanes/H-theme.md.

### Lane G: player

- `@ad/player` and the `/watch/[videoId]` page: HLS playback with token and key handling, custom controls, resume, progress, captions viewer, quality, up next, recovery states, sample HLS generator and Playwright smoke.

### Lane D: video pipeline

- Add `@ad/video` (upload, encoding, captions, playback authorization, lifecycle), `@ad/queue` (pg-boss helpers), `apps/whisper`, `apps/edge` and worker handlers for every lane D queue. Migration 0007. Decisions D-027 to D-030, D-037, D-045 to D-048.

### Lane E: viewer UI

- Add the `@ad/ui` component library and the viewer pages in `apps/web`: landing, sign-in, sign-up, verify, recovery, profiles, Home, Browse, Search, title, series, My List, account, legal, help and system pages.

### Lane F: admin UI

- Add the admin area in `apps/web` under `/admin`: shell with role aware menu and breadcrumbs, dashboard, videos list, upload with a resumable multi file queue, video edit with status checklist, poster picker and crop, publish and schedule dialog, encoding queue, captions list and review, series, categories, trash, home curation with live preview, users, roles and invites, audit log with detail panel and CSV export, analytics (overview and per video) with accessible SVG charts, my account and system.
- Add `lib/uploader` (framework free resumable upload engine with fake, simulated and HTTP transports) and `lib/admin` (`can`, cue and poster rules, formatters).
- Add typed admin services with fixture implementations, real audit, analytics and player quality reads with `ADMIN_DATA=real`, and a guard that refuses fixture data in production.

### Lane K2: video delivery integration

- Wire the lane D routes into `apps/web`: `POST /api/play/{id}/session`, playlists at `/api/play/{id}/{file}`, `GET /api/hls/keys/{id}`, the admin upload API, encoding status, caption list and approve, publish, and the development only `/api/dev-storage` and `/api/dev-media` routes, with real sessions, same origin checks, client address handling and the shared rate limiter.
- Add `POST /api/watch/progress` for the player sink, reusing the lane C progress service.
- Attach approved caption tracks to the Watch page data.
- Fix the playback store reading profiles outside the account (row level security hid every profile from the web role).
- Register the nightly analytics rollup, monthly view event prune and monthly audit prune in the worker. Add `DATABASE_URL_MAINTENANCE`, `WHISPER_FAKE` and `WORKER_SCRATCH_MIN_FREE_RATIO`. Migration 0016. Decisions D-079 to D-082.
- Add the real pipeline Playwright spec `apps/web/e2e/video-pipeline.e2e.ts` and `scripts/e2e-video-up.sh`.

### Lane J2: quality review

- Remove unused code and four unused dependencies, show an invite as expired only for rejected tokens, and bring DEV-SETUP, ARCHITECTURE, DATA-MODEL and TESTING in line with the built repo. Findings are in `docs/QUALITY-REVIEW.md`.

### Lane M3: media and brand

- Add image variants and generated posters, sprite seek previews, failed encode cleanup, caption script alignment, a placeholder brand kit, six theme presets with a publish e2e, and branded emails. See `docs/lanes/M3-media-brand.md`.

### Lane M1: launch tooling

- Added `pnpm launch:apply`, `pnpm secrets:generate`, `pnpm content:import`, `pnpm backup:run` and `pnpm backup:restore` in the new `@ad/launch` package, `client.example.json`, the production compose file, Caddyfile, `ops/` scripts, tools image and `.env.production.example`, `/healthz` and `/readyz`, a Lighthouse mobile budget, and `docs/LAUNCH-RUNBOOK.md` and `docs/CLIENT-INPUTS.md`. `docs/DEPLOYMENT.md` and `docs/DEV-SETUP.md` now match what was built.
### Lane A2: admin stories audit

- Audit M12 to M20 and M27 to M30 stories, merge the audit writers, read retention from settings, add invite codes, fix analytics export rows, keep series rows on Home in step, page the video list in the database, coalesce caption autosaves, and add the staff bell with email choices.

### Lane P1: sign in and sign up to the mockups

- Rebuilt S01 sign in (landing split and mobile) and S02 sign up (desktop bar, card, mobile sticky submit) to match `S01_landing_sign_in*.dc.html` and `S02_sign_up*.dc.html`, including every stacked state, with Space Grotesk headings, the four segment strength meter and checklist, Caps Lock hint, invite code field and the session ended notice from `?notice=ended`. Real auth behaviour, Turnstile and enumeration safe messages are unchanged. See `docs/lanes/P1-auth-pages.md`.

### Lane R1: three viewer stories

- Added the en-NG message catalog (`@ad/shared/messages`) with auth, account and player copy wired through it, the Always ask who is watching device setting, and a cached profile picker with a stale note.

### Lane L7 review: Languages mockups

- Fixed S140 to S149 for targets, switches, contrast, the 240 px header, Editor and detection states, and wrote the L7 review.

### Lane L3: Admin polish, bulk actions, captions control

- Added a shared bulk framework (selection, bar, progress, report, undo) and bulk actions for videos, captions approval, captions availability, encoding retry and cleanup, Trash restore and delete forever, series, viewer accounts and staff.
- Added upload shared details and a per-file override table, one breadcrumb component, and table alignment and stacked mobile cards.
- Series delete is now admin only. Restore from Trash returns a video as a draft.
- Publish later on upload (L3-16) is not built yet.

### Lane L1: Guest access (M40)

- Anyone can now browse, search and watch without an account. A visitor gets a guest header, tab bar and footer, the full title and series pages, and the player, from an account free catalog path that reads no personal table. Personal routes stay 401 for a guest.
- Added the guest identity cookie, guest playback tokens (`gst`, `kd`) and 20 minute guest segment links (setting `limits.guest_segment_minutes`), with the Edge Worker unchanged.
- Added a Sign in to save dialog, a My List explainer, a remembered save that finishes after sign in, Continue learning and episode progress from the device, and an import of device history into a profile after sign in.
- Added Kids mode for visitors (a device switch, kids safe tokens and analytics, a blocked screen, and the kids profile hint), and the settings `features.guest_play` and `features.guest_audience` with `client.json` fields `guestPlay` and `guestAudience`.
- Added limits for guest sessions and a Turnstile check after 3 refusals from one network in 10 minutes, and `robots.txt` with `noindex` on search and My List.
- Fixed documents: segment URLs live 2 hours for accounts (SECURITY.md said 6), a kids profile on a non-kid video gets 404 (M31-S01), and the key limits in M31-S02.
- Not built: Clear history on this device (M40-S18), the audience select on the admin Features screen, and the Playwright journey specs.


### Lane L9: Sponsors and donations (M48)

- Slice 0: docs now allow labelled sponsor cards and hosted checkout donations, both off by default and never for kids. Added 38 monetization settings (all off, client inputs empty), cross key checks, and the `PAYSTACK_SECRET_KEY`, `PAYSTACK_BASE_URL` and `DONATE_RECEIPT_TOKEN_SECRET` variables.

### Lane L6: Discovery (M45)

- Slice 6b: search results now show corrected spelling, did you mean, and subject matches; empty searches are logged anonymously as misses and pruned after 90 days by the nightly job.

### Lane L5: Engagement (M44), notifications, Continue learning and My List

- Slice 7 and 8: adult profiles get a notification bell, a `/notifications` page, per account choices at `/account/notifications` and an opt in daily or weekly email digest with one click unsubscribe. New episode and new video notices are made by a worker job and kept 60 days. Kids profiles get none.
- Slice 10: My List has Started and Not started filters and four sorts kept in the URL. Continue learning cards show Next: E4 for a next up episode, a menu with Remove from row and Undo, and take the row title from the curated descriptor.
- Slice 11: the data export now lists ratings, notices and notification choices (never the sealed address), and account purge also removes the notification choices. Web push stays a Could and is not built.

### Lane L2: Home hero, rows and sections (M41)

- The Home hero rotates every 10 seconds by default with a Pause control, holds on hover and focus, and stops under reduced motion, Data saver or after two loops. With no hero titles chosen the five newest titles with artwork rotate.
- Admins create, rename, reorder and remove sections, give each a View all setting (automatic, custom or none) and a minimum, and restore the launch layout. New default rows are seeded once by the apply tool.
- View all opens four list pages under `/browse` (new, trending, series and a manual section).
- A worker makes a six second muted clip for each video. Editors choose Automatic, a start point or Off, and write a headline, description and button label for each hero slide. The clip plays only on a fast link with Data saver off and motion allowed.
- Mouse users get a hover card after 300 ms. Rows show 2.3 to 6.3 cards, and the loading skeleton matches the hero.
- Lane L7 languages (M46): interface languages Yoruba, Igbo, Hausa and Pidgin behind an off by default switch, with a language picker, locale aware numbers, dates and plurals, English per key fallback, and a pseudo language for layout checks.
- Lane L7 admin Languages screens: status per language, publish above a threshold with a Super admin override, a translate workspace with placeholders and plural forms, CSV and JSON export and import that land In review, a missing key report, and sample drafts for Yoruba, Igbo and Hausa that stay unreviewed until a native speaker and an Admin approve them.
- Lane L7 caption translations: spoken language and detection, multilingual Whisper, machine translation through a provider adapter that is off by default with a monthly cap, side by side review, a Publish switch per language, and a viewer caption menu that lists only approved published languages.
- Lane L7 copy extraction: player text, viewer mail and the offline page read from the message catalog, viewer mail and the offline page follow the account language, and `getLocale` reads the account language.

### Lane L2 hero clip upgrade, part 1: 20 second clips with sound and a backfill button (M41)

- Hero clips are up to 20 seconds (site setting 6 to 30), the whole video when it is no longer than that, and keep a low bitrate audio track so a viewer can unmute. Older silent 6 second clips keep working and hide the sound button until they are cut again. Migration 0058.
- New button Generate previews for all videos on Admin, Home curation (admins) queues a clip for every published video that has none or an out of date one. It is safe to press again.
- Hero slides stay 20 seconds by default (was 10, setting 5 to 60). Clips now play on browsers that do not report connection speed and from 2 Mbps (settings), which is why the owner saw only the still before.

### Lane L2 hero clip upgrade, part 2: timing (M41)

- A hero slide with a playing clip now stays until the clip ends (setting Slide waits for its clip, on by default), otherwise slides change after the seconds setting. The dot fill runs over the time the slide really stays. Clips play from 2 Mbps (setting) and the carousel still stops after two loops, under reduced motion and Data saver.

### Lane L2 hero clip upgrade, part 3: sound button (M41)

- The Home hero clip plays muted by itself and a button beside Pause turns the sound on and off (Unmute and Mute). It shows only for clips that have sound, never on Kids profiles or under reduced motion, stops when the tab hides, and the next clip follows the choice. A site switch can remove it. The slide indicator is now five filling segments.

### Lane L12 mobile header, part 1: the header (S182 to S185)

- On phones the header is the logo, a Search icon and one account icon (a person for a visitor, the avatar for a signed in profile), plus the bell when signed in. Visitors and signed in viewers now share one bar, so signing in changes only the last slot. The visitor bar no longer shows Sign in, Create account and Menu beside the logo; from 960 px Sign in and Create account stay in the bar.
- The brand name never wraps: it clips, steps down under 400 px, hides under 400 px when the bell shows and under 340 px always (the link keeps its name for screen readers). A Kids bar shows the logo mark and a Kids word badge. The header and tab bar are not drawn on the watch page.
- Pressed and hover fills on the bar icons, a width test in Chromium at 320, 360 and 414 with long Yoruba, Igbo and Hausa labels (no overflow, no overlap, 44 px targets), decision D-374.

### Lane L12 mobile header, part 2: the account sheet

- On phones the account icon opens a bottom sheet instead of a popover: Sign in (the one filled button), Create account, a Kids mode switch with its help line and Help for a visitor, and the profile name, kind and the usual menu for a signed in viewer. It traps focus, closes with Escape or Close, and gives focus back to the icon. Wider screens keep the popover. Decision D-378.

### Lane L12 mobile header, part 3: the tab bar

- Tab labels longer than 12 characters get a warning in the translation workspace (the four `nav` tab keys, on save and on import) and are clipped with an ellipsis in the bar. The focus ring sits inside each tab, pressed and hover states are added, and a phone in landscape gets a 44 px bar with the label beside the icon. Width tested at 320, 360, 414 and landscape with long Yoruba, Igbo and Hausa labels. Decision D-380.

### Lane L12 mobile header, part 4: scrim token and docs

- The bar scrim over the Home hero now holds 0.85 through the whole bar and fades over the new token `--nav-scrim-fade` below it (it replaces `--nav-scrim-hold`), so icons stay readable over pale posters. A test reads the resolved gradient and checks the contrast. A second test checks the header does not move when the display font loads in a different width. Design system 11.8 and 11.12, the screen map (S81, S182 to S185) and stories M47-S17 to M47-S19 describe the phone header, sheet and tab bar. Decision D-381.

### Lane L11 Browse page redesign (S186)

- Browse has one category rail that never wraps (native scroll snap, edge fades, arrow buttons on fine pointers only, the selected chip scrolled into view, 44 px links) and one quiet bar with two menu buttons, Length and Sort. They open a popover menu on desktop and a bottom sheet on phones, apply at once, tint when set and show a Clear link. The choices stay in the URL. The rail and bar stick under the nav, and on phones the bar hides on scroll down and returns on scroll up.
- Results stream behind a skeleton that holds its height, the count sits beside the title, the two empty states have one action each, and Show more has idle, loading and failed states (failed shows Try again only).
- The length filter now matches its labels: Under 5 min, 5 to 15 min and Over 15 min (was under 3, 3 to 5, 5 and over). Saved links with `length=short`, `medium` or `long` keep working. Decisions D-382 and D-383. Measured width tests in Chromium at 320, 360, 414 and 1360.

### Lane KB-P2 help panel and states (M50, S197 and S198)

- The Help button in the top bar opens a contextual panel (drawer from 60rem, bottom sheet below) showing the guide for the current screen with its steps, video and Open the full guide. The question mark key opens it when no field has focus. Tab is trapped, Escape, Close and a swipe down close it, focus returns to the opener. With no guide it shows search and the core tasks. The `InlineHint` pattern opens a guide section in the panel. Decision D-384.
- Help pages have offline, slow, server error, not found and video error states with one action each, and progress saves keep the chosen state and retry by themselves with a quiet toast. Decision D-386.
- Fixes found by the new `apps/web/e2e/admin-help.e2e.ts` (axe and layout at 360, 600, 960 and 1280): the top bar Help button had no name below 60rem, the help search box was 40 px tall, and the glossary used an invalid definition list.
