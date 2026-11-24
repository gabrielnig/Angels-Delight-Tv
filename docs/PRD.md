# Product Requirements Document: Angels Delight TV

Status: draft 1 for client review. Source of truth for scope is `docs/PROJECT-BRIEF.md`. This document turns the brief into requirements. Where a requirement depends on a client choice it is marked [CLIENT] and stays configurable.

Companion documents: `docs/MODULES.md` (module list), `docs/USER-STORIES.md` (stories and acceptance criteria), `docs/SCREEN-ARCHITECTURE.md` (screens and routes), `docs/GLOSSARY.md` (terms).

## 1. Vision

Angels Delight TV is a free, self-hosted, Netflix-style streaming platform for educational videos. A viewer opens it on a cheap Android phone in Lagos, picks their profile, taps a title and watches without waiting, without paying, and without burning through their data bundle. Later, the same experience reaches the Nigerian diaspora and the wider world.

The content is owned by the client, Sister Vanessa, and lives on infrastructure she controls, not on YouTube. She runs the whole catalogue herself from `/admin`: upload, encode, caption, review, curate and publish, with no developer needed for daily work.

One line: **short educational videos, watched anywhere, owned by the people who made them.**

## 2. Problem and opportunity

- Educational video for Nigerian audiences is mostly on platforms that interrupt viewing with adverts, push unrelated content, and give the owner little control of presentation.
- Data is expensive and networks are uneven. Most video sites assume fast connections and recent phones.
- The client has about 100 AI-generated educational videos (1 to 8 minutes each, about 13 hours) and wants a branded home for them with a familiar, trusted streaming experience.
- Captions matter for comprehension, for noisy environments, for viewers who read English better than they hear it, and for accessibility. They must be accurate, so a human approves them.

Opportunity: a small, fast, owned platform that does a few things very well, at about 12 to 17 USD per month to run.

## 3. Goals

| Id | Goal | Measured by |
|---|---|---|
| G1 | Playback starts quickly and keeps going on poor networks | Startup time p75 under 4 s on 3G class connection, rebuffer ratio under 2 percent |
| G2 | The viewer experience feels familiar and effortless | A new viewer reaches playback from landing in under 90 seconds including sign up |
| G3 | Viewers pick up where they left off, per person | Resume success rate above 99 percent, per profile |
| G4 | The client runs the platform alone | Upload to published for one video takes an admin under 10 minutes of hands-on time (excluding encoding wait) |
| G5 | Captions are accurate before viewers see them | 100 percent of published videos have an approved caption track |
| G6 | Look and feel are owned by the client | Colours, fonts, logo and name changed from admin with no deploy |
| G7 | Safe for families | Kids profiles never show non-kid content; no personal data beyond what is needed |
| G8 | Cheap and maintainable | Running cost at or below 17 USD per month at launch scale; one developer can operate it |
| G9 | Accessible | WCAG 2.2 AA on all viewer screens and the admin core flows |

## 4. Non-goals (explicit)

- No subscriptions to watch, no paywall and no third party ads. Optional labelled sponsor slots (still image or text cards, first party only) and optional donations through a hosted checkout are allowed. Both are module M48, both are off by default, and neither ever appears for kids profiles or Kids mode.
- No live streaming at launch (possible later; architecture should not prevent it).
- No user generated content, comments, likes, ratings or social features by viewers.
- No DRM (Widevine, FairPlay). Signed URLs and HLS encryption are the protection level.
- No native iOS or Android apps. The PWA covers installation.
- No offline downloads of video at launch.
- No recommendation engine based on machine learning. Rows are curated, with simple smart rows.
- No translation of the interface at launch (message catalogs are prepared).
- No casting (Chromecast, AirPlay) at launch (Could for phase 3).
- No multi-tenant use. One brand, one platform.
- No third party video hosting or YouTube embeds.

## 5. Personas

### P1. Tobi, viewer on a cheap Android in Lagos (primary)

- Age 22 to 40. Android phone with 2 GB RAM, small screen, cracked corners, Chrome or Opera Mini fallback less likely but Chrome most likely. Prepaid data bundles, tops up small amounts. Sometimes on Wi-Fi at work or a cafe, mostly on mobile data that drops between 3G and 4G.
- Watches in short sessions on the bus, during breaks, at night. Often interrupted, so resuming matters.
- Needs: fast first load (under about 300 KB of JS on the first screen), low data per minute, captions because of noise, one tap to resume, large tap targets, works in portrait.
- Pain points: buffering, apps that waste data, forms that fail when the connection blips, losing place in a video.
- Success: opens the site from a WhatsApp link, signs up once, installs to home screen, watches three videos a week on a data budget.
- Design implications: data saver, 360p friendly ladder, small posters, offline screen, retry that does not lose state, install prompt, no auto-playing previews on mobile data.

### P2. Chidinma, diaspora viewer (phase 2)

- Age 28 to 55, lives in the UK, US or Canada. Laptop, tablet or smart TV browser. Fast connection, expects HD.
- Watches with family, sometimes with kids who are learning about home culture and language.
- Needs: 1080p, full screen, keyboard controls, captions, maybe other languages later, time zones that make sense, a trustworthy privacy policy.
- Pain points: slow transatlantic delivery (solved by the CDN), unclear data rules, content that is geo-limited.
- Success: sets up family profiles, uses the big screen, trusts the platform with her email.
- Design implications: high quality renditions, CDN delivery, GDPR aware privacy page, locale aware dates.

### P3. Kemi (age 8), a kid profile

- Uses a parent's account via a kids profile on a shared phone or tablet. Reads slowly, taps big targets, has no account of her own.
- Needs: only suitable content, a simple Home, big cards, captions on by default (set by parent), no way to leave the safe area by accident.
- Parent needs: kids profile cannot reach account settings, profile management, or non-kid titles. Exit needs the account password.
- Design implications: strict filtering at the data layer (not only in the UI), restricted navigation, no search leakage.

### P4. Sister Vanessa, admin and content owner (client)

- Role: Admin. Not a developer. Comfortable with Google Drive and WhatsApp, learns by doing. Probably on a laptop, sometimes a phone for quick checks. Often on a good home connection but not guaranteed.
- Responsible for: uploading videos, checking captions, writing descriptions, choosing what appears on Home, scheduling releases, changing the look.
- Needs: obvious steps, status she can understand (not "job 4812 failed"), safe undo, clear warnings, a preview of what viewers will see, confidence that nothing is public until she says so.
- Pain points: fear of breaking the live site, uploads that fail at 90 percent, not knowing whether captions are right.
- Success: publishes a new video unaided in under 10 minutes of her time.
- Design implications: resumable uploads with honest progress, plain language statuses, publish checklist, drafts by default, preview as viewer, undo for deletes.

### P5. ARKDEV, super admin and developer

- Role: Super admin. Builds and operates the platform from Lagos. Needs to manage roles, site configuration, infrastructure health, dead jobs and the audit log, and to support Sister Vanessa remotely.
- Needs: observability, reproducible deploys, safe defaults, configuration over code changes, clear audit trail, ability to impersonate nothing (no impersonation by design).
- Success: the platform runs for weeks without intervention; problems are seen before the client reports them.

### P6. Support helper (secondary, Editor or Analyst role)

- A delegate Sister Vanessa trusts to edit descriptions and curate Home (Editor) or to view reports (Analyst). Has fewer permissions by design.

## 6. Scope

### 6.1 Phase 1 (launch, Must and Should)

Viewer: sign up and verification, sign in, forgot and reset password, lockout, profiles including kids, Home with hero and rows, browse by category, search, title detail and series page, player with captions, speed, quality, autoplay next, Continue Watching, My List, account settings, legal pages, PWA install, offline screen, data saver.

Admin: admin login with roles and 2FA, upload (resumable, multi-file), encoding queue and status, thumbnails, content management (videos, series, categories), caption review and approve, publish and schedule, Home curation, theme settings, users overview, analytics (views and watch time), audit log, roles, site configuration.

Platform: R2 plus CDN delivery, signed URLs, HLS encryption, rate limits, backups, observability, CI and deployment.

### 6.2 Phase 2

- Caption translations (NLLB-200 or a paid service) with per-language review: Yoruba, Igbo, Hausa, Pidgin, [CLIENT] to confirm languages.
- Interface in more languages.
- Diaspora tuning: regional CDN review, GDPR processes, time zone display.
- Audio language tracks (alternate narration) (Could).
- Download for offline (Could).
- Email digests of new titles (opt in).

### 6.3 Phase 3 and later

- Live streaming.
- Casting.
- Native wrappers if the PWA proves limiting.
- Recommendation improvements.

## 7. Functional requirements

Requirements are numbered FR-nn and mapped to modules and stories. Priority uses Must, Should, Could.

### 7.1 Accounts and access (M01, M02, M03, M35)

| Id | Requirement | Priority | Module |
|---|---|---|---|
| FR-01 | A visitor can sign up with email and password and must verify the email before watching | Must | M01 |
| FR-02 | Password rules prioritise length (minimum 10), block very common passwords, show a live checklist and strength meter, never block paste | Must | M01 |
| FR-03 | Verification by a 6 digit code and by link; code expires in 15 minutes, link in 24 hours; resend has a cooldown | Must | M01 |
| FR-04 | Sign in with email and password; sessions persist for 30 days on the device unless the viewer signs out | Must | M01 |
| FR-05 | Forgot and reset password by single use emailed link valid for 1 hour; all sessions revoked after reset | Must | M01 |
| FR-06 | After 5 failed sign-in attempts in 15 minutes for one account or one IP the account is locked for 15 minutes; messages never reveal whether an email exists | Must | M01, M23 |
| FR-07 | One account holds up to 5 profiles (configurable) | Must | M03 |
| FR-08 | Profile picker after sign in; remember last profile per device | Must | M03 |
| FR-09 | Create, edit, delete profiles; at least one profile must remain | Must | M03 |
| FR-10 | Kids profile sees only kid suitable titles, cannot open account or profile management, exit requires the account password | Must | M35 |
| FR-11 | Account settings: change email, change password, view and revoke sessions, export data, delete account | Should | M02, M32 |
| FR-12 | Optional PIN to protect a profile | Could | M03 |

### 7.2 Discovery (M04, M05, M06, M07, M10)

| Id | Requirement | Priority | Module |
|---|---|---|---|
| FR-20 | Home shows a hero banner and horizontal rows; 5 cards visible on desktop | Must | M05 |
| FR-21 | Rows include Continue Watching and My List when not empty, then curated rows | Must | M05, M09, M10 |
| FR-22 | Browse by category with sort and duration filter | Must | M06 |
| FR-23 | Search across title, description, category and tags; tolerant of typos | Must | M06 |
| FR-24 | Title detail with poster, description, duration, categories, caption availability, Play or Resume, My List, share | Must | M07 |
| FR-25 | Series page with episodes, per episode progress, Play next | Must | M07 |
| FR-26 | My List per profile, add and remove from anywhere | Must | M10 |
| FR-27 | Share link produces a rich preview in WhatsApp and similar | Should | M07 |
| FR-28 | Related titles on the detail page | Should | M07 |

### 7.3 Playback (M08, M09, M11, M25)

| Id | Requirement | Priority | Module |
|---|---|---|---|
| FR-30 | Adaptive HLS playback with auto quality and manual choice of 360, 480, 720, 1080 | Must | M08 |
| FR-31 | Controls for play, pause, seek, volume, full screen, speed, captions, quality, on mouse, touch and keyboard | Must | M08 |
| FR-32 | Captions on and off, language choice, remembered per profile; only approved tracks | Must | M11 |
| FR-33 | Resume from last position per profile; start and finish thresholds as defined in section 8 | Must | M09 |
| FR-34 | Autoplay next episode or suggested title with a cancellable countdown, per profile setting | Must | M08 |
| FR-35 | Buffering, error recovery, offline detection and retry without losing position | Must | M08 |
| FR-36 | Data saver caps quality at 360p and stops prefetch | Must | M25 |
| FR-37 | Picture in picture and media session lock screen controls where supported | Should | M08 |
| FR-38 | Seek bar preview thumbnails | Could | M08, M36 |
| FR-39 | Installable PWA, offline shell and offline screen | Should | M25 |

### 7.4 Admin content (M12 to M17, M28, M36)

| Id | Requirement | Priority | Module |
|---|---|---|---|
| FR-40 | Admin login with email, password and TOTP 2FA; roles Super admin, Admin, Editor, Analyst | Must | M12 |
| FR-41 | Resumable, multi-file, direct to R2 upload with progress, speed, ETA, per file retry | Must | M13 |
| FR-42 | Upload preview card with thumbnail, type, size, completion badge, Replace and Remove | Must | M13 |
| FR-43 | Encoding to 360, 480, 720, 1080 HLS (not above source), encrypted, with visible status and retry | Must | M14 |
| FR-44 | Poster candidates auto generated; admin selects or uploads own | Must | M36 |
| FR-45 | English captions auto generated; admin reviews, edits and approves each track; unapproved tracks never reach viewers | Must | M15 |
| FR-46 | Videos list with search, filters, bulk actions, cursor pagination synced to URL | Must | M16 |
| FR-47 | Video edit: title, description, categories, tags, kid suitability, poster, status | Must | M16 |
| FR-48 | Series, seasons, episodes, ordering | Must | M16 |
| FR-49 | Categories CRUD with reorder and safe delete | Must | M16 |
| FR-50 | Publish now, schedule, unpublish, with a checklist | Must | M28 |
| FR-51 | Home curation: hero, rows, order, live preview | Must | M17 |
| FR-52 | Soft delete with undo window | Should | M16 |

### 7.5 Admin platform (M18 to M21, M27, M29)

| Id | Requirement | Priority | Module |
|---|---|---|---|
| FR-60 | Theme settings: colours, fonts from curated list, sizes, logo, platform name, live preview, reset, contrast warning | Must | M18 |
| FR-61 | Theme stored as CSS variables in the database with history and restore | Must | M18 |
| FR-62 | Analytics: views, unique viewers, watch time, completion, top titles, date range, CSV | Must | M19 |
| FR-63 | Audit log of all admin writes and sensitive viewer events, filterable, exportable | Must | M20 |
| FR-64 | Users overview with safe support actions, all audited | Should | M27 |
| FR-65 | Role management by Super admin only | Must | M12 |
| FR-66 | Site configuration: name, domain, contacts, limits, flags | Must | M29 |
| FR-67 | Email notifications for admin: encoding failed, captions ready | Should | M21 |
| FR-68 | Legal and static pages editable with versioning | Should | M26 |

### 7.6 Platform and security (M22, M23, M24, M30 to M34)

| Id | Requirement | Priority | Module |
|---|---|---|---|
| FR-70 | Video bytes are served from R2 through the Cloudflare CDN on a custom domain, never from the VPS | Must | M22 |
| FR-71 | Playback needs a short lived signed URL; HLS keys require an authorised session | Must | M31 |
| FR-72 | Rate limiting on auth, search and write endpoints | Must | M23 |
| FR-73 | Daily database backup, restore tested | Must | M32 |
| FR-74 | Health checks, structured logs, error tracking, alerts to the developer | Must | M24 |
| FR-75 | Background jobs with retry, visibility and scheduling | Must | M30 |
| FR-76 | Reproducible deploy through CI to the VPS | Must | M33 |
| FR-77 | WCAG 2.2 AA conformance for viewer screens | Must | M34 |
| FR-78 | Data export and account deletion honouring NDPA | Should | M32 |

## 8. Business rules (decisions this PRD makes)

These are the recommended defaults. Each is configurable in site configuration (M29) and logged in `docs/DECISIONS.md` when implemented.

1. **Resume start threshold.** If the saved position is under 5 seconds, the video starts from 0 and counts as not started. Otherwise resume at saved position minus 3 seconds (rewind on resume), never below 0.
2. **Finished threshold.** A video is finished when watched to 95 percent of its duration, or when 10 seconds or fewer remain, whichever comes first. On finish the saved position resets to 0, `finished_at` is set, and the title leaves Continue Watching.
3. **Progress save cadence.** Every 10 seconds while playing, on pause, on seek end, on tab hide, and with a beacon on page close. Writes are idempotent, last write wins by client timestamp validated against server time, and the position may not move backwards from a different device within 5 seconds unless it is a user seek.
4. **Series continue.** If an episode finishes, Continue Watching shows the next episode (position 0) instead of the finished one. If the last episode finishes, the series leaves the row.
5. **Continue Watching expiry.** Items not touched for 60 days drop from the row (history is kept). Configurable.
6. **Per profile.** Progress, My List, caption choice, speed, autoplay and data saver are per profile. Account level: email, password, sessions.
7. **Sign-in lockout.** 5 failures in 15 minutes lock that account for 15 minutes; 20 failures per IP per 15 minutes lock that IP for 15 minutes. Successful sign in resets the account counter. Admin login uses 3 failures in 15 minutes and a 30 minute lock.
8. **Sessions.** Viewer sessions last 30 days sliding. Admin sessions last 8 hours absolute with 30 minute idle timeout.
9. **Profiles.** Up to 5 per account. Name 1 to 20 characters. Names need not be unique across accounts, but must be unique inside an account.
10. **Kids.** Kids profiles see only titles flagged `kids`. Exiting a kids profile needs the account password.
11. **Captions gate.** A video cannot be published until it has an approved English caption track, unless an Admin overrides with a reason, which is audited. Configurable.
12. **Publish gate.** Needs: encoding complete, poster chosen, title, description, at least one category, suitability set.
13. **Ladder.** 360p, 480p, 720p, 1080p, never upscaled beyond source height. Lowest rung target is at or below 400 kbps total so one minute costs roughly 3 MB at 360p.
14. **Upload limits.** Maximum 5 GB per file. Accepted: MP4, MOV, MKV, WebM. Part size 8 MB, 3 parts in parallel per file, 2 files in parallel by default.
15. **Account deletion.** 14 day grace period, then purge of account, profiles, progress and lists. Audit entries keep only a hashed identifier.

## 9. Non-functional requirements

### 9.1 Performance
- First viewer page (Home, signed in) transfers under 300 KB of JavaScript and under 1 MB total on first load, excluding posters below the fold.
- LCP under 2.5 s on a mid-range Android on simulated slow 4G, under 4 s on 3G class.
- Video startup under 4 s p75 on 3G class, under 2 s p75 on broadband.
- Poster images in WebP or AVIF, sized by container, lazy loaded below the fold.
- API p95 under 300 ms for catalog reads at launch scale.

### 9.2 Reliability and capacity
- Launch scale assumption: up to 5,000 registered accounts and 500 concurrent viewers. The VPS handles pages and APIs only; video bytes come from the CDN.
- Availability target 99.5 percent monthly for the site, excluding provider outages.
- Encoding worker survives restarts and resumes without data loss.
- Uploads survive network loss, browser reload and laptop sleep.

### 9.3 Security and privacy
- Per `docs/SECURITY.md`: argon2id hashing, HttpOnly Secure SameSite cookies, CSRF protection, CSP and other headers, rate limits, validated inputs, least privilege R2 credentials.
- Personal data kept to email, password hash, profile names and avatars, watch progress, list items. No phone numbers, no addresses, no birth dates. Kids profiles store no age.
- NDPA compliant processing notice, data export and deletion. GDPR ready for phase 2.
- Admin accounts require 2FA.
- No third party trackers. Analytics are first party and aggregated.

### 9.4 Accessibility
- WCAG 2.2 AA. Keyboard operable player and menus. Captions available. Visible focus. Contrast checked, with the theme editor warning when a colour pair fails.
- Respect reduced motion and large text settings.
- Minimum 44 by 44 CSS pixel tap targets for primary controls.

### 9.5 Compatibility
- Android Chrome (last 3 years of versions, Android 8 and up), iOS Safari 15 and up, desktop Chrome, Edge, Firefox, Safari (latest 2 versions). Opera Mini is not supported (a plain message is shown).
- Screen widths from 320 px upward. Primary phone design at 360 px.

### 9.6 Maintainability
- One Next.js codebase, TypeScript, Postgres, Docker Compose. Test driven development, scoped test runs, CI.
- Configuration over code for anything the client decides.
- Follows `docs/AI-CODE-FOOTPRINT.md` (no swallowed errors, no speculative abstractions, no em or en dashes).

### 9.7 Observability
- Structured logs with request ids, error tracking, uptime and worker heartbeat alerts, player quality metrics.

### 9.8 Content and rights
- Videos are AI generated. The client confirms rights and any disclosure wording [CLIENT]. The platform shows the legal text she supplies and keeps a record of her confirmation in the audit log.

## 10. Success metrics

Targets are for the first 90 days after launch unless stated. Baselines are unknown, so these are starting targets to adjust.

| Metric | Target | Source |
|---|---|---|
| Sign up to verified email conversion | at least 70 percent | M01 events |
| Verified account to first play within 24 h | at least 60 percent | M19 |
| Video startup time p75 on mobile data | under 4 s | M24 player metrics |
| Rebuffer ratio | under 2 percent of watch time | M24 |
| Playback error rate | under 1 percent of play attempts | M24 |
| Average videos watched per active viewer per week | at least 3 | M19 |
| Completion rate (finished threshold) | at least 55 percent | M19 |
| Resume usage (plays starting from Continue Watching) | at least 25 percent of plays | M09, M19 |
| Share of watch time with captions on | tracked, no target | M19 |
| Install prompt acceptance | at least 8 percent of repeat visitors | M25 |
| Admin time to publish a new video | under 10 minutes hands-on | admin timing test |
| Published videos with approved captions | 100 percent | M15 |
| Time to first byte for Home (p75, Lagos) | under 800 ms | M24 |
| Lighthouse (mobile) | Performance 85 or above, Accessibility 95 or above | CI |
| Monthly running cost | at or below 17 USD | billing |
| Support requests about "can't sign in" | under 5 percent of active accounts per month | M27 |

## 11. Risks and mitigations

| Id | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Client input is late (colours, name, domain, content, legal text) | High | Medium | Everything configurable, defaults from the brief, placeholders marked draft, decisions logged |
| R2 | Poor mobile networks cause buffering and abandonment | High | High | ABR with 360p rung at low bitrate, short segments, data saver, CDN, retry logic, test on throttled devices |
| R3 | AI generated captions are inaccurate | Medium | High | Human review required before viewers see captions; script alignment when scripts exist |
| R4 | Encoding worker overloads the VPS | Medium | Medium | Single concurrency by default, queue, CPU limits, nice priority, encode off peak, monitor |
| R5 | Cloudflare or R2 account ownership dispute or lockout | Low | High | Client owned account when possible, documented handover, backups of sources |
| R6 | Content rights or AI disclosure challenged | Medium | High | Client confirms rights, legal pages, audit record, takedown process documented |
| R7 | Credential stuffing and brute force | Medium | Medium | Lockouts, rate limits, breached password blocklist, generic errors, optional Turnstile |
| R8 | Video hotlinking and bandwidth abuse | Medium | Medium | Signed URLs, HLS encryption, short expiry, rate limits on key endpoint, R2 free egress |
| R9 | Email deliverability (verification emails land in spam) | High | High | Proper SPF, DKIM, DMARC, reputable provider, plain templates, code and link, resend, support contact |
| R10 | Video.js v10 maturity | Medium | Medium | Early spike, wrapper interface limited to one adapter, Vidstack and Plyr fallbacks documented |
| R11 | Single VPS failure | Medium | Medium | Nightly backups to R2, documented restore, Hetzner fallback, Compose redeploy in under 2 hours |
| R12 | Scope creep (social, payments, live) | Medium | Medium | Non-goals list, change log in decisions |
| R13 | Kids profile exposure to unsuitable content | Low | High | Filter at query layer, default deny, publish warning, tests |
| R14 | Data privacy complaint or breach | Low | High | Minimal data, hashing, encryption at rest for backups, breach runbook, NDPA notice |
| R15 | Developer single point of failure | Medium | Medium | Documentation, handover doc, reproducible deploys, client owned accounts |
| R16 | Slow admin uploads from home connections | High | Medium | Resumable multipart, parallel parts, honest progress, can pause and resume next day |
| R17 | Low-end devices cannot decode 1080p | Medium | Low | Default to Auto with device capability cap, user selectable |
| R18 | Domain not purchased or name changes late | Medium | Low | Domain and name only in config, no hardcoded URLs |

## 12. Assumptions and dependencies

- Content is English at launch [CLIENT to confirm]. Captions are English first.
- About 100 videos, 1 to 8 minutes, total about 13 hours. Source files under 2 GB each, typically under 500 MB.
- Sister Vanessa has a laptop with a browser and can receive email.
- A Cloudflare account, domain and VPS will be created. Ownership is to be agreed [CLIENT].
- The domain `angelsdelight.tv` is under consideration and not yet bought. No code assumes it.
- Email sending uses a provider with a free or low cost tier at this scale.
- Card data never touches our servers: donations use the payment provider's hosted checkout by redirect, with no provider script on our pages, so PCI scope stays at SAQ A level at most. Donations and sponsors are off until the owner switches them on (M48).

## 13. Phases and milestones

Dates are not committed because the launch date is a client input [CLIENT]. Sizes are relative.

| Phase | Name | Contents | Exit criteria |
|---|---|---|---|
| 0 | Foundations | Repo, CI, Compose, config service, job queue, security baseline, design tokens, observability basics | CI green, deploy to staging, health checks |
| 1 | Viewer core | Auth, accounts, profiles, catalog read, Home, Browse, Search, Title detail | A seeded catalog can be browsed on mobile |
| 2 | Pipeline | Admin auth and roles, upload, encoding, storage and CDN, signed playback, player | One video uploaded, encoded and played end to end |
| 3 | Captions and curation | Caption pipeline and review, content management, series, publish, scheduling, Home curation | Admin publishes a captioned video with no developer |
| 4 | Viewer depth | Continue Watching, My List, kids mode, autoplay next, PWA, data saver, settings | Viewer acceptance checklist passes |
| 5 | Control and trust | Theme settings, analytics, audit log, users overview, legal pages, backups, accessibility pass | Client UAT passed |
| 6 | Launch | Load rehearsal, content load of 100 videos, DNS cutover, monitoring, handover | Go live, handover document delivered |
| 7 | Phase 2 | Translations, extra languages, diaspora tuning | Separate plan |

Milestones are checkpointed in small batches with progress logged in `ai-context.md`.

## 14. Open questions for the client [CLIENT]

1. Final platform name and domain.
2. Final colours, logo and fonts (defaults ship from the brief).
3. Content language at launch and which Nigerian languages come next.
4. Do scripts exist for the videos (for caption alignment)?
5. Who reviews captions: Sister Vanessa only, or a delegate?
6. Legal pages: terms, privacy, About text, contact details.
7. Rights confirmation and AI disclosure wording.
8. Who owns the Cloudflare account, domain registrar login and VPS account?
9. Target launch date.
10. Sign up open to everyone, or invite only for a soft launch?
11. Which titles are kid suitable?
12. Sender email address and name for system emails.

## 15. Traceability

Each functional requirement above lists its module. Each module in `docs/MODULES.md` is covered by stories in `docs/USER-STORIES.md` with identifiers `Mxx-Syy`. Each screen in `docs/SCREEN-ARCHITECTURE.md` lists the stories it realises. Changes to a requirement must update the related story and screen entries in the same session.
