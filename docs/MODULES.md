# Modules

Every buildable module of Angels Delight TV, with purpose, responsibilities, data owned, dependencies and readiness.

- **[READY]**: can be built now. Nothing here waits on Sister Vanessa.
- **[CLIENT]**: needs client input before it can be finished (colours, name, domain, content, legal text, languages, account ownership). The module is still built now, but the input stays configurable and is never hardcoded. The input needed is listed.

Related documents: `docs/PRD.md` (why), `docs/USER-STORIES.md` (what, per module), `docs/SCREEN-ARCHITECTURE.md` (screens), `docs/GLOSSARY.md` (terms).

## 1. Module index

| Id | Module | Area | Readiness |
|---|---|---|---|
| M01 | Auth (viewer) | Viewer | [READY] |
| M02 | Accounts | Viewer | [READY] |
| M03 | Profiles | Viewer | [READY] |
| M04 | Catalog | Core | [READY] |
| M05 | Home and rows | Viewer | [CLIENT] |
| M06 | Browse and search | Viewer | [READY] |
| M07 | Title detail and series page | Viewer | [READY] |
| M08 | Player | Viewer | [READY] |
| M09 | Continue Watching | Viewer | [READY] |
| M10 | My List | Viewer | [READY] |
| M11 | Captions (viewer side) | Viewer | [READY] |
| M12 | Admin auth and roles | Admin | [READY] |
| M13 | Upload | Admin | [READY] |
| M14 | Encoding worker | Backend | [READY] |
| M15 | Caption pipeline and review | Admin and backend | [CLIENT] |
| M16 | Content management (videos, series, categories) | Admin | [READY] |
| M17 | Home curation | Admin | [READY] |
| M18 | Theme settings | Admin | [CLIENT] |
| M19 | Analytics | Admin | [READY] |
| M20 | Audit log | Admin | [READY] |
| M21 | Notifications and email | Backend | [CLIENT] |
| M22 | Storage and CDN | Infrastructure | [CLIENT] |
| M23 | Security | Cross cutting | [READY] |
| M24 | Observability | Cross cutting | [READY] |
| M25 | PWA and low-data | Viewer | [READY] |
| M26 | Settings and legal pages | Viewer | [CLIENT] |
| M27 | Admin users and profiles overview | Admin | [READY] |
| M28 | Publishing and scheduling | Admin | [READY] |
| M29 | Site configuration | Admin | [CLIENT] |
| M30 | Job queue and scheduler | Backend | [READY] |
| M31 | Playback authorization (signed URLs and HLS keys) | Backend | [READY] |
| M32 | Data lifecycle: backup, export, deletion | Backend | [CLIENT] |
| M33 | Deployment and CI | Infrastructure | [CLIENT] |
| M34 | Accessibility and internationalisation | Cross cutting | [READY] |
| M35 | Kids mode and content suitability | Viewer | [READY] |
| M36 | Artwork and thumbnails | Admin and backend | [READY] |
| M47 | Design system tuning and guards | Cross cutting | [READY] |

36 modules in total. M01 to M26 follow the planned set. M27 to M36 are modules found while breaking the brief down: they own behaviour that would otherwise be spread across several modules with nobody responsible.

## 2. Dependency overview

Reading order for building (earlier items unblock later ones):

1. M33 Deployment and CI, M23 Security, M24 Observability, M30 Job queue (foundation).
2. M22 Storage and CDN, M31 Playback authorization.
3. M12 Admin auth and roles, M01 Auth, M02 Accounts, M03 Profiles.
4. M04 Catalog, M16 Content management, M36 Artwork.
5. M13 Upload, M14 Encoding worker, M15 Caption pipeline.
6. M08 Player, M11 Captions viewer, M09 Continue Watching, M10 My List.
7. M05 Home, M06 Browse and search, M07 Title detail, M17 Curation, M28 Publishing.
8. M18 Theme, M29 Site configuration, M26 Legal pages, M25 PWA, M19 Analytics, M20 Audit log, M21 Email, M27 Users overview, M32 Data lifecycle, M35 Kids mode, M34 Accessibility (applied throughout).

## 3. Module details

Each module lists: purpose, responsibilities, data owned, dependencies, client input.

---

### M01 Auth (viewer) [READY]

**Purpose.** Let viewers create credentials, prove their email, sign in and recover access safely, on weak networks and cheap phones.

**Responsibilities.**
- Sign up with email and password, password strength rules, live checklist and strength meter.
- Email verification by 6 digit code and link, with resend cooldown.
- Sign in, sign out, sign out of all devices, session handling with HttpOnly cookies.
- Forgot password and reset by emailed single use token.
- Failed attempt tracking and temporary lockout, with generic error messages that do not reveal whether an email is registered.
- Session expiry, rotation after password change, revocation.

**Data owned.** `sessions`, `email_verifications`, `password_resets`, `login_attempts`.

**Dependencies.** M02 (account records), M21 (sending emails), M23 (rate limits, hashing, CSRF), M24 (logging).

**Client input.** None. Email sender name and address come from M29 (default placeholders used until set).

---

### M02 Accounts [READY]

**Purpose.** Own the account record: email, password hash, verification state, security settings, and the account level settings screen.

**Responsibilities.**
- Account record, email change (with re-verification), password change.
- Account settings page: email, password, devices and sessions, data export, delete account.
- Enforce one account to many profiles with a limit (default 5, configurable in M29).
- Account status: unverified, active, locked, suspended, deleted.

**Data owned.** `accounts`, account level preferences.

**Dependencies.** M01, M03, M32 (export and deletion), M21.

**Client input.** None.

---

### M03 Profiles [READY]

**Purpose.** Netflix style profiles inside one account so family members keep separate history, lists and settings.

**Responsibilities.**
- Profile picker screen after sign in, remembers the last used profile on a device.
- Create, edit, delete profile (name, avatar from a preset set, kids flag, language, autoplay, data saver default).
- Last profile protection (cannot delete the final profile).
- Optional profile PIN (Could).
- Switch profile from the header at any time.

**Data owned.** `profiles`, `profile_settings`, avatar preset list.

**Dependencies.** M02, M35 (kids rules), M09, M10 (data cascade on delete), M26.

**Client input.** Avatar artwork set [CLIENT, minor]: a neutral default set ships and can be replaced.

---

### M04 Catalog [READY]

**Purpose.** The single source of truth for what titles exist, how they relate and what viewers may see.

**Responsibilities.**
- Data model for videos, series, seasons, episodes, categories, tags, ratings (kid suitability), languages.
- Read APIs for viewer facing queries: rows, category lists, title lookups, only published and visible items.
- Visibility rules: published, scheduled windows, kid filtering, region filters (later).
- Slug generation and uniqueness, redirects when slugs change.
- Search index maintenance (Postgres full text, trigram).

**Data owned.** `titles`, `videos`, `series`, `episodes`, `categories`, `title_categories`, `tags`, `slug_redirects`.

**Dependencies.** M16 (writes), M28 (visibility), M35, M22 (media URLs).

**Client input.** The content list, descriptions and category names arrive with content [CLIENT for content only]. The module itself is [READY].

---

### M05 Home and rows [CLIENT]

**Purpose.** The landing page for a signed in profile: hero banner plus horizontal rows.

**Responsibilities.**
- Hero banner (featured title with Play and More info).
- Rows from M17 curation plus personal rows (Continue Watching, My List).
- Horizontal scrolling rows, 5 cards visible on desktop, swipe on touch, arrow buttons and keyboard on desktop.
- Lazy loading of rows below the fold, skeletons, empty and error states.
- Kids profile home with filtered content.

**Data owned.** None of its own (reads curation and catalog data).

**Dependencies.** M04, M09, M10, M17, M35, M25.

**Client input.** Final colours, logo and platform name come through M18 and M29. Layout is built now. [CLIENT] because visual identity is not final, though nothing is blocked.

---

### M06 Browse and search [READY]

**Purpose.** Let viewers find content by subject and by typing.

**Responsibilities.**
- Browse by category page with sort and filter (newest, shortest, A to Z; duration bucket).
- Search with debounce, suggestions, tolerant matching (typos, accents), results grouped by titles and series.
- Recent searches per profile (Could), empty and no result states with suggestions.
- URL synced query state for sharing and back button.

**Data owned.** `search_history` (per profile, optional), search index definitions.

**Dependencies.** M04, M35, M03.

**Client input.** None.

---

### M07 Title detail and series page [READY]

**Purpose.** Tell the viewer what a title is and let them start, resume, save or share it.

**Responsibilities.**
- Title detail page: poster, title, description, duration, categories, caption availability, Play or Resume, My List toggle, share.
- Series page: season selector, episode list with per episode progress, Play next unwatched.
- Related titles row.
- Share link with proper meta tags (Open Graph) for WhatsApp previews.

**Data owned.** None of its own.

**Dependencies.** M04, M08, M09, M10, M11, M35.

**Client input.** None.

---

### M08 Player [READY]

**Purpose.** Reliable, accessible, low-data video playback of HLS on everything from a cheap Android phone to a desktop browser.

**Responsibilities.**
- Video.js v10 with hls.js engine, ABR, quality menu (Auto, 360, 480, 720, 1080), playback speed (0.5x to 2x).
- Controls for mouse, touch and keyboard, full screen, picture in picture where supported, orientation handling on mobile.
- Captions menu and styling (via M11), autoplay next with cancel, up next tile.
- Resume at saved position (via M09), progress reporting every 10 seconds.
- Buffering indicators, network error recovery with retry and quality drop, offline detection, expired URL refresh.
- Seek preview thumbnails (Could), media session API for lock screen controls.
- Data saver cap (via M25).

**Data owned.** Playback sessions (ephemeral), player preferences stored in profile settings.

**Dependencies.** M31 (signed playlist and keys), M09, M11, M25, M35, M24 (client error reporting), M22.

**Client input.** None. Player fallback decision (Vidstack or Plyr) only if Video.js v10 fails evaluation.

---

### M09 Continue Watching [READY]

**Purpose.** Remember where each profile stopped and make resuming one tap.

**Responsibilities.**
- Save position per profile per video: every 10 seconds, on pause, on tab hide, on page close (beacon).
- Resume rules: start threshold, finish threshold, rewind on resume, series next episode logic.
- Continue Watching row ordering (most recent first), remove from row, hide finished.
- Watch history (for analytics and the "watched" tick on episodes).
- Conflict handling when two devices write at once (last write wins by server timestamp, never moves backwards by more than the seek).

**Data owned.** `watch_progress` (profile_id, video_id, position_seconds, duration_seconds, updated_at, finished_at), `watch_events` for analytics.

**Dependencies.** M03, M04, M08, M05, M19.

**Client input.** None. Thresholds are configurable defaults in M29.

---

### M10 My List [READY]

**Purpose.** Per profile saved titles for later.

**Responsibilities.**
- Add and remove from card, detail page and player.
- My List page and Home row, newest added first.
- Optimistic UI with rollback.
- Handle titles that get unpublished (hidden, not deleted from the list).

**Data owned.** `my_list_items`.

**Dependencies.** M03, M04, M35.

**Client input.** None.

---

### M11 Captions (viewer side) [READY]

**Purpose.** Show approved captions in the player, with viewer controls.

**Responsibilities.**
- Load only approved WebVTT tracks for the video.
- Captions on/off, language choice (English at launch), remembered per profile.
- Style options: size, background, colour from a safe set (Could).
- Do not show tracks that are not approved. Signal when a title has no captions.

**Data owned.** Per profile caption preference.

**Dependencies.** M08, M15 (approved tracks), M22, M03.

**Client input.** Languages beyond English [CLIENT, phase 2].

---

### M12 Admin auth and roles [READY]

**Purpose.** Secure sign in to `/admin` and permissions per role.

**Responsibilities.**
- Separate admin login page, stricter than viewer sign in: lockout, 2FA (TOTP) required for all admin roles, shorter session.
- Roles: Super admin, Admin, Editor, Analyst, with a permission matrix.
- Role assignment and revocation (Super admin only), cannot remove the last Super admin.
- Admin invitation by email, first sign in forces password set and 2FA enrolment.
- Permission checks on every server action, not only in the UI.

**Data owned.** `admin_roles`, `admin_permissions`, `admin_invites`, `totp_secrets` (encrypted), `recovery_codes` (hashed).

**Dependencies.** M01 patterns, M20 (audit), M21 (invites), M23.

**Client input.** Who gets which role [CLIENT, minor]. Initial: ARKDEV Super admin, Sister Vanessa Admin.

---

### M13 Upload [READY]

**Purpose.** Get large video files from an admin's device to R2 reliably, even on a bad connection.

**Responsibilities.**
- Direct to R2 multipart upload using presigned part URLs, resumable across page reloads and network drops.
- Multi-file queue with independent lanes, per file progress, speed and ETA, retry, pause, cancel.
- File validation (type, size, duration probe after upload), duplicate detection (hash or name and size).
- Rich preview card on completion, Replace and Remove actions.
- Create the draft video record, start the encoding job (M14).
- Orphan cleanup of abandoned multipart uploads.

**Data owned.** `uploads`, `upload_parts`.

**Dependencies.** M22, M12, M14, M16, M30, M20.

**Client input.** None.

---

### M14 Encoding worker [READY]

**Purpose.** Turn source files into HLS renditions with thumbnails and loudness normalised audio.

**Responsibilities.**
- Probe source (duration, resolution, codecs, audio presence).
- Encode ladder 360, 480, 720, 1080 (never upscale above source), H.264 and AAC, 6 second segments, keyframe aligned, master playlist.
- HLS AES-128 encryption with per video key (see M31).
- Generate poster candidates and optional sprite sheet (M36).
- Upload renditions to R2, update status, handle failures with retry and backoff, resumable per rung.
- Expose progress (percent and stage) to the admin encoding queue.
- Trigger the caption job (M15) after audio extraction.

**Data owned.** `encoding_jobs`, `renditions`.

**Dependencies.** M13, M22, M30, M31, M36, M15, M24.

**Client input.** None. Ladder and bitrates are configuration.

---

### M15 Caption pipeline and review [CLIENT]

**Purpose.** Produce, review and approve captions for every video.

**Responsibilities.**
- Generate English WebVTT with faster-whisper from extracted audio.
- If a script exists, align it (forced alignment) instead of free recognition.
- Review screen: video with caption overlay, cue list, edit text and timing, find and replace, jump to cue.
- States: none, generating, needs_review, approved, rejected. Only approved shown to viewers.
- Re-generate, upload own `.vtt` or `.srt` (converted), download.
- Phase 2: translations (NLLB-200 or a paid service), each language reviewed and approved separately.

**Data owned.** `caption_tracks`, `caption_cues` (or VTT file refs), `caption_revisions`.

**Dependencies.** M14, M16, M22, M30, M20, M11.

**Client input.** Whether scripts exist and where they come from, language list, who reviews captions (Sister Vanessa or a delegate) [CLIENT].

---

### M16 Content management (videos, series, categories) [READY]

**Purpose.** Admin create, read, update and delete for the catalog.

**Responsibilities.**
- Videos list: search, filter by status and category, bulk actions, sort, cursor pagination synced to URL.
- Video edit: title, description, categories, tags, kid suitability, poster choice, captions link, status, publish settings.
- Series and episodes: create series, seasons, order and reorder episodes, assign videos.
- Categories: create, rename, reorder, hide, merge, delete with reassign.
- Soft delete with undo window, hard delete rules (removes R2 objects).

**Data owned.** Writes to M04 tables.

**Dependencies.** M04, M12, M13, M15, M20, M28, M36.

**Client input.** Content titles, descriptions, categories [CLIENT for data, module is READY].

---

### M17 Home curation [READY]

**Purpose.** Let the editor shape Home without developer help.

**Responsibilities.**
- Choose the hero title (or a rotation of up to 5).
- Create, order, rename, show or hide rows. Row types: Manual list, Category, Newest, Series, Smart (most watched this week).
- Add, remove and reorder titles in a manual row by drag and drop and by keyboard.
- Live preview of Home (desktop and mobile widths).
- Fixed personal rows (Continue Watching, My List) position control.

**Data owned.** `home_rows`, `home_row_items`, `hero_slots`.

**Dependencies.** M04, M12, M16, M20, M05.

**Client input.** None. Which rows exist is [CLIENT] content choice.

---

### M18 Theme settings [CLIENT]

**Purpose.** Let the owner change look and feel without code. Stored as CSS variables in the database.

**Responsibilities.**
- Edit colours (background, ink, muted, border, banner, accent), fonts from a curated list, base size, logo upload, platform name.
- Live preview, reset to default, contrast warning against WCAG AA, publish or save as draft theme.
- Theme history with restore.
- Apply as CSS variables on the server rendered `<html>`, cached, with safe fallback.

**Data owned.** `theme_settings`, `theme_versions`, logo asset reference.

**Dependencies.** M12, M20, M29, M22 (logo storage).

**Client input.** Final colours, logo, name, fonts [CLIENT]. Defaults: `#F5F5F2` background, `#1A1C22` ink, `#5B606B` muted, `#DEDDD6` border, `#1F6FB5` banner, `#FFC93C` accent.

---

### M19 Analytics [READY]

**Purpose.** Show views and watch time so the owner knows what works.

**Responsibilities.**
- Collect play events (start, progress buckets, finish) with consent aware, privacy light design.
- Admin dashboard: views, unique viewers, watch time, completion rate, top titles, trend over time, device split, country split (coarse).
- Per video analytics page, date range, CSV export.
- Aggregations pre-computed daily for speed.

**Data owned.** `watch_events`, `daily_title_stats`, `daily_site_stats`.

**Dependencies.** M09, M08, M12, M30.

**Client input.** None.

---

### M20 Audit log [READY]

**Purpose.** Accountability and traceability for admin and sensitive actions.

**Responsibilities.**
- Append-only entries: actor, role, action, target type and id, before and after (redacted), IP, user agent, time.
- Viewer sensitive events: password change, email change, lockout, account deletion.
- Admin screen: filter by actor, action, date, target, CSV export.
- Retention policy (default 24 months), tamper evident hashing chain (Could).

**Data owned.** `audit_log`.

**Dependencies.** All modules write to it, M12 reads.

**Client input.** Retention period preference [CLIENT, minor].

---

### M21 Notifications and email [CLIENT]

**Purpose.** Reliable transactional email and in-app notices.

**Responsibilities.**
- Templates: verification code, welcome, password reset, password changed, new device sign in (Could), admin invite, caption ready for review, encoding failed, account deletion confirmation.
- Provider adapter (Resend, Brevo or SMTP), bounce handling, sender domain setup (SPF, DKIM, DMARC).
- Admin in-app notices: encoding finished or failed, captions need review.
- Plain text and HTML, small size for slow data.

**Data owned.** `email_outbox`, `email_events`, `admin_notifications`.

**Dependencies.** M30, M01, M12, M14, M15, M29.

**Client input.** Sender name, from address, support address, domain for sending [CLIENT, depends on the final domain].

---

### M22 Storage and CDN [CLIENT]

**Purpose.** Store and serve sources, renditions, captions and images.

**Responsibilities.**
- R2 buckets and prefix layout (`sources/`, `hls/`, `captions/`, `images/`, `backups/`), lifecycle rules.
- Custom domain through Cloudflare CDN (for example `video.yourdomain.com`), cache rules, CORS.
- Presigned URL generation for upload, signed access for playback (with M31).
- Never proxy VPS hosted video through Cloudflare.
- Storage usage reporting to the admin dashboard.

**Data owned.** Object key conventions, `storage_objects` index.

**Dependencies.** M31, M13, M14, M33.

**Client input.** Cloudflare account ownership, final domain [CLIENT].

---

### M23 Security [READY]

**Purpose.** Cross cutting protections defined in `docs/SECURITY.md`.

**Responsibilities.**
- Password hashing (argon2id), session cookie flags, CSRF protection, security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy).
- Rate limiting by IP and by account for sign in, sign up, reset, resend, search, progress writes.
- Input validation at trust boundaries, output encoding, upload validation, SSRF safe fetches.
- Secrets management, dependency scanning, least privilege for R2 keys.
- Bot protection on sign up (Turnstile, Could).

**Data owned.** `rate_limit_buckets`, `blocked_ips` (small).

**Dependencies.** M24, M33.

**Client input.** None.

---

### M24 Observability [READY]

**Purpose.** Know when something breaks before the client does.

**Responsibilities.**
- Structured logs, request ids, error tracking, uptime checks, worker heartbeat.
- Player quality metrics (startup time, rebuffer ratio, error codes) from the client.
- Alerts to the developer for failed jobs, disk usage, certificate expiry, error spikes.
- Health endpoints (`/healthz`, `/readyz`).

**Data owned.** `player_metrics` (aggregated), log streams.

**Dependencies.** M33, M30.

**Client input.** None.

---

### M25 PWA and low-data [READY]

**Purpose.** Make the product feel light and dependable on low-end Android and expensive data.

**Responsibilities.**
- Web app manifest, install prompt, service worker caching the app shell and static assets.
- Offline screen, cached last Home skeleton, queued progress writes sent when back online.
- Data saver mode: cap at 360p, no preview autoplay, lazy poster loading at reduced size, no prefetch of next episode.
- Performance budgets (LCP, JS size), image sizes via responsive formats (AVIF or WebP).
- Network aware hints (Save-Data header, effective connection type).

**Data owned.** Client side caches.

**Dependencies.** M08, M05, M09, M36.

**Client input.** App icon and name for install [CLIENT, minor, via M18 and M29].

---

### M26 Settings and legal pages [CLIENT]

**Purpose.** Static and legal pages and the viewer settings screens.

**Responsibilities.**
- Terms of Use, Privacy Policy, Cookie notice (if needed), About, Contact and Help.
- Editable from admin (rich text, versioned) with last updated date.
- Viewer settings: playback (autoplay, data saver, default captions), language, display.
- Footer links, 404 and error pages.

**Data owned.** `pages`, `page_versions`.

**Dependencies.** M29, M12, M20.

**Client input.** Legal text, About copy, contact details, rights confirmation text [CLIENT].

---

### M27 Admin users and profiles overview [READY]

**Purpose.** Support staff view of viewer accounts to help with problems without seeing private data.

**Responsibilities.**
- Searchable users list with status, created date, last active, profile count.
- User detail: profiles (name, kids flag), sessions, verification state. No watch history by default.
- Actions: resend verification, force sign out, suspend and unsuspend, unlock, trigger password reset email. Deletion by request only (Super admin).
- Every action audited.

**Data owned.** None of its own.

**Dependencies.** M02, M03, M12, M20, M21.

**Client input.** None.

---

### M28 Publishing and scheduling [READY]

**Purpose.** Control when a video or series becomes visible.

**Responsibilities.**
- Status model: draft, processing, ready, scheduled, published, unpublished, archived.
- Publish now, schedule for a date and time (Africa/Lagos default zone), unpublish, republish.
- Publish checklist: encoding done, poster chosen, caption approved (configurable), title and description present, category set.
- Scheduler job promotes scheduled items at their time.
- Series rule: series is visible only when at least one episode is published.

**Data owned.** `publish_schedule`, status history.

**Dependencies.** M04, M16, M30, M15, M20.

**Client input.** Launch date [CLIENT]. Module is READY.

---

### M29 Site configuration [CLIENT]

**Purpose.** Everything that varies by client and must not be hardcoded.

**Responsibilities.**
- Platform name, tagline, domain, support email, social links, default language.
- Feature flags (kids profiles, My List, autoplay default, data saver default, sign up open or invite only).
- Limits (profiles per account, lockout thresholds, progress thresholds, upload size).
- Maintenance mode banner.
- Read by all modules through one typed config service with safe defaults.

**Data owned.** `site_settings`.

**Dependencies.** M12, M20.

**Client input.** Name, domain, support contact, launch decisions [CLIENT].

---

### M30 Job queue and scheduler [READY]

**Purpose.** Reliable background work.

**Responsibilities.**
- Postgres backed queue (no extra infrastructure at launch) with states: queued, running, succeeded, failed, dead.
- Retry with exponential backoff, max attempts, visibility timeout, heartbeat.
- Scheduled jobs: publish scheduled items, daily analytics rollup, orphan upload cleanup, session cleanup, backups, email retries.
- Admin visibility into dead jobs and a manual retry.

**Data owned.** `jobs`, `job_runs`, `schedules`.

**Dependencies.** M24, M33.

**Client input.** None.

---

### M31 Playback authorization (signed URLs and HLS keys) [READY]

**Purpose.** Make sure only signed in viewers can watch published content, without DRM.

**Responsibilities.**
- Issue a short lived signed master playlist URL for an authorised profile.
- Key endpoint for HLS AES-128 that checks the session and video visibility.
- Signed segment access via CDN token or signed cookie with expiry, refresh before expiry during playback.
- Kids profile and unpublished content checks.
- Rate limit key requests, log denials.

**Data owned.** `hls_keys` (encrypted at rest), key rotation metadata.

**Dependencies.** M22, M14, M01, M03, M23.

**Client input.** None.

---

### M32 Data lifecycle: backup, export, deletion [CLIENT]

**Purpose.** Protect data and respect privacy rights (NDPA, GDPR in phase 2).

**Responsibilities.**
- Nightly Postgres backups to R2 (encrypted), retention 14 daily and 8 weekly, restore drill documented.
- Viewer data export (JSON) and account deletion with grace period (default 14 days).
- Deleted profile data purge (progress, list).
- Backup of R2 sources for disaster (separate bucket, optional).

**Data owned.** `deletion_requests`, backup manifests.

**Dependencies.** M02, M03, M22, M30, M21.

**Client input.** Privacy officer or contact, retention choices, account ownership for backup storage [CLIENT].

---

### M33 Deployment and CI [CLIENT]

**Purpose.** Repeatable deploys to the VPS.

**Responsibilities.**
- Docker Compose stack (app, worker, Postgres, reverse proxy), environment config, secrets handling.
- GitHub Actions: lint, typecheck, scoped tests on changed paths, build image, deploy over SSH.
- Staging and production, zero downtime restart where practical, migrations step.
- Domain, DNS, HTTPS certificates.

**Data owned.** Pipeline and compose files.

**Dependencies.** M22, M23, M24.

**Client input.** VPS account ownership, domain purchase, DNS access [CLIENT].

---

### M34 Accessibility and internationalisation [READY]

**Purpose.** Everyone can use it, and text is ready for more languages.

**Responsibilities.**
- WCAG 2.2 AA: keyboard operability, focus visibility, labels, contrast, reduced motion, screen reader announcements for player state and toasts.
- All UI strings in message catalogs, English at launch, locale aware dates and numbers (en-NG).
- Right-to-left safe layout choices (not needed yet, no hardcoded left or right where logical properties work).
- Accessibility test checklist in CI (axe checks on key screens).

**Data owned.** Message catalogs.

**Dependencies.** All UI modules, M18 (contrast).

**Client input.** Interface languages beyond English [CLIENT, phase 2].

---

### M35 Kids mode and content suitability [READY]

**Purpose.** Make kids profiles safe by default.

**Responsibilities.**
- Suitability flag on each title (`all`, `kids`, `general`, `mature`), kids profiles see only `kids`.
- Kids profile restrictions: no account or profile management, no search of non-kid content, simplified UI option (Could).
- Exit from kids profile requires account password.
- Admin warning when publishing without a suitability value.

**Data owned.** Suitability enum and rule definitions.

**Dependencies.** M03, M04, M05, M06, M16.

**Client input.** Which content counts as kids suitable [CLIENT, content decision].

---

### M36 Artwork and thumbnails [READY]

**Purpose.** Produce and manage the images that sell each title.

**Responsibilities.**
- Auto poster candidates from video frames (6 candidates), choose one, or upload custom poster and hero image.
- Responsive image sizes (320, 640, 960 wide) in WebP or AVIF, blur placeholder.
- Optional sprite sheet for seek preview.
- Aspect rules: card 16:9, hero 21:9 and 16:9 crops, safe area guidance for text overlay.

**Data owned.** `images`, `image_variants`.

**Dependencies.** M14, M16, M22, M25.

**Client input.** Custom artwork if wanted [CLIENT, optional].

---

## 4. Readiness summary

**Counts.** [READY] modules (27): M01, M02, M03, M04, M06, M07, M08, M09, M10, M11, M12, M13, M14, M16, M17, M19, M20, M23, M24, M25, M27, M28, M30, M31, M34, M35, M36. [CLIENT] modules (9): M05, M15, M18, M21, M22, M26, M29, M32, M33. Total 36.

**What the [CLIENT] modules wait on:**

| Module | Needs from the client | Built now with |
|---|---|---|
| M05 | Final look | Default theme from the brief |
| M15 | Scripts, reviewers, languages | Auto recognition, English only |
| M18 | Colours, logo, fonts, name | Defaults from the brief, reset to default |
| M21 | Sender domain, names | Placeholder sender, SMTP adapter |
| M22 | Cloudflare account, domain | Developer owned account, config only |
| M26 | Legal text, About copy | Placeholder pages marked draft |
| M29 | Name, domain, contacts | Placeholders in config |
| M32 | Retention and privacy contact | Defaults |
| M33 | VPS and domain ownership | Developer owned staging |

Nothing in a [CLIENT] module blocks starting. The rule from `CLAUDE.md` applies: take the recommended option, log it in `docs/DECISIONS.md`, keep it configurable.
