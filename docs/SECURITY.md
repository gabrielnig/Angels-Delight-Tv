# Security

Status: design stage, binding for all code. Adapts `/home/claude/shared-protocols/docs/SECURITY-BASELINE.md`, `security-scanning-harness.md`, `self-healing-pipeline.md` and `ai-context-protocol.md` to Angels Delight TV. Related: `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `docs/TDD-PROTOCOL.md`.

Compliance notes in section 12 are engineering guidance, not legal advice. The client should confirm obligations with a Nigerian data protection practitioner before launch.

## 1. Security posture

Self-hosted on one VPS, no managed safety net. AI-assisted development tends to skip object-level authorization and ship permissive defaults, so every control here is explicit and has a test.

Assets, in order of value:
1. Viewer personal data (emails, profile names, watch history, children's profiles).
2. Admin and editor accounts (they control all content and theme).
3. Secrets (key-encryption keys, token secrets, storage credentials).
4. Content integrity (the catalog, captions, theme).
5. Availability and cost control (CPU on the VPS, R2 operations).

Content is free and educational, so content confidentiality is the lowest priority. Hotlinking and casual downloading are deterred, not prevented (no DRM).

## 2. STRIDE threat model

| Threat | Scenario in this project | Countermeasure | Test or check |
|---|---|---|---|
| Spoofing | Credential stuffing on login. Forged playback token. Forged signed segment URL. Spoofed `X-Forwarded-For` to dodge rate limits. | argon2id, per account and per IP token buckets, generic errors, equalized timing, MFA for staff. HMAC tokens with key id rotation. IP taken only from `CF-Connecting-IP` when `TRUSTED_PROXY_MODE=cloudflare` and origin firewall allows only Cloudflare ranges. | Login limit tests, token tamper tests, header spoof test |
| Tampering | Client edits a profile id or video id in a request. Mass assignment of `role`. Altered upload part sizes. Modified theme tokens to inject CSS. | Server-side ownership checks and RLS, Zod `.strict()` with explicit field whitelists, size verification at completion, theme tokens allowlist (no raw CSS), lockfile with frozen installs. | IDOR suite, mass assignment tests, theme schema tests |
| Repudiation | Admin denies unpublishing a video or changing a role. | Append-only `audit_log` with insert-only grants and trigger, request ids, staff MFA. | Audit trigger test, audit coverage test per admin action |
| Information disclosure | Profile or watch history of another account. Unpublished or kids-unsafe video exposed. Emails in logs. Raw originals public. DB dump leaks PII. | RLS plus ownership checks, visibility predicate on every read, redacted logs, private originals bucket, field-level encryption with separately stored keys. Response DTOs, never raw rows. | IDOR and visibility tests, log redaction test, bucket policy check in launch checklist |
| Denial of service | Login floods burning argon2 CPU. Search floods. Upload abuse filling disk or R2. Encode queue flooded. Cache-busting query strings. | Token buckets (section 7), hash concurrency cap of 2, input size limits, upload only for staff, per-creator pending upload cap (20, D-089), queue concurrency 1 for heavy jobs, Cloudflare rules, media cache key ignores query. | Rate limit tests, load check before launch |
| Elevation of privilege | Viewer reaches `/admin` or admin API. Editor changes roles. Next.js middleware bypass. Server Action called directly. Worker compromised pivots to account data. | Role checks inside every handler and service (never only middleware), separate DB roles (worker has no account table grants), explicit permission matrix, re-authentication for sensitive actions, Server Actions treated as public endpoints. | Authorization matrix test generated from the table in section 5 |

Additional abuse cases specific to this platform:
- Malicious media upload exploiting FFmpeg (SSRF or local file read through crafted playlists, parser bugs): section 8.
- Subtitle injection (HTML or script in WebVTT): section 8.
- Child safety: kids profile bypass through URL guessing or search: section 12.
- Account enumeration through signup and reset: section 4.
- Playback token replay by another user: bounded lifetime, bound to profile, rate limited (accepted residual risk R-3, section 18).

## 3. OWASP Top 10 mapping

Mapped to the 2021 list used by the shared baseline. Re-map when the baseline moves.

| Item | Controls here |
|---|---|
| A01 Broken Access Control | Section 5. Ownership check before any profile data. RLS on `accounts`, `profiles`, `watch_progress`, `my_list`. Visibility predicate for catalog. Role checks in handlers. IDOR tests. |
| A02 Cryptographic Failures | argon2id, AES-256-GCM field encryption, HMAC tokens, TLS via Cloudflare Full (strict), HSTS, wrapped keys, separate keys DB. Section 10. |
| A03 Injection | Drizzle parameterized queries, no string-built SQL (raw SQL only through tagged `sql` templates), Zod validation, CSP with nonces, output encoding by React, VTT sanitization, FFmpeg invoked with an argument array (no shell). |
| A04 Insecure Design | This document, STRIDE table, kids rules, fail-closed RLS, no DRM claims. |
| A05 Security Misconfiguration | Headers and CSP (section 14), non-root containers, read-only root filesystems where possible, bucket policies, pre-deploy checklist (section 16). |
| A06 Vulnerable and Outdated Components | Section 13: lockfile, audit, release-age delay, image scans, SBOM. |
| A07 Identification and Authentication Failures | Section 4: argon2id, breached password check, rate limits, MFA for staff, session rotation and revocation. |
| A08 Software and Data Integrity Failures | Frozen lockfile installs, human review of every AI-written change, signed-by-CI images pinned by digest, no auto-merge. |
| A09 Security Logging and Monitoring Failures | Section 15: structured logs, audit log, alerts. |
| A10 Server-Side Request Forgery | No user-supplied URLs fetched by the server. Whisper receives only internally generated presigned URLs. FFmpeg protocol whitelist. Outbound allowlist from worker containers. |

## 4. Authentication model

Custom database-backed sessions (rationale in ARCHITECTURE.md 3.1).

Viewer sign in options (M49):
- Two step verification is optional TOTP for viewers (staff stay required). Recovery codes are single use and shown once. Sign in with the right password returns a signed 10 minute note, not a session, until the code is accepted. There is no self service bypass, an admin reset is audited and emailed.
- Continue with Google is optional and hidden unless `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set. Authorization code with PKCE (S256), state and nonce in a signed one shot cookie. The ID token is checked for RS256 signature, issuer, audience, expiry, nonce and `email_verified === true`. Link rules: verified email only, password confirmation to link to an existing verified account, never auto link by email, staff excluded. Our two step verification still applies after Google. A Google only account has no password hash.
- Login events record country, time and outcome only (never IP), kept 90 days (`LOGIN_EVENT_RETENTION_DAYS`), pruned daily. New device email keys off a first party device cookie hash.
- Sign out everywhere needs the password and ends this session too.

Passwords:
- argon2id via `@node-rs/argon2`, starting parameters m = 19456 KiB, t = 2, p = 1, tuned on the production VPS to roughly 100 to 250 ms. Parameters stored in the PHC string. Rehash on login when parameters are stale.
- Minimum 10 characters, maximum 128, no composition rules, paste allowed, zxcvbn feedback in the UI.
- Breached password check against the HIBP range API (k-anonymity, only a 5 character hash prefix leaves the server). Timeout 2 seconds. If the service is unreachable the signup proceeds and a warning is logged. This is a deliberate, documented fallback.
- Hashing concurrency capped at 2 in-process so floods cannot exhaust RAM or CPU.
- Login for an unknown email verifies against a fixed dummy hash so timing does not reveal existence. All login failures return the same message.

Signup, verification and reset (no enumeration):
- Signup with an existing email returns the same "check your email" screen and sends an "you already have an account" email instead.
- Email verification token: 256-bit random, only SHA-256 stored, single use, 24 hour life. Unverified accounts cannot create profiles or request playback.
- Reset token: 256-bit random, hash stored, 30 minute life, single use. Reset revokes every session of the account and requires re-login. The response is identical whether or not the email exists.
- Optional Cloudflare Turnstile on signup and reset request (`TURNSTILE_*`).

Sessions:
- Token: 256-bit random, base64url, only SHA-256 stored in `sessions`. Rotated at login and on privilege change (MFA, password change).
- Cookie: name `__Host-ad_session` in production (`ad_session` in development over http). Attributes: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`. Max-Age equals the idle window for viewers and is a session cookie for staff.
- Lifetimes: viewers idle 30 days and absolute 90 days (mobile friendly). Staff idle 60 minutes and absolute 8 hours.
- Revocation: logout, password change, password reset, role change, suspension and account deletion revoke sessions (`revoked_at`). Account page lists active sessions with revoke buttons.
- Profile cookie `ad_profile` carries only a profile id and is a hint, never trusted. Every request re-verifies that the profile belongs to the session account.
- Kids lock: the session row stores `active_profile_id` and `kids_locked`. Selecting a kids profile sets the lock. While it holds, every viewer route and the playback session refuse any other profile id (`kids_gate`, 403), the cookie is ignored, and only exit kids mode with the account password clears it. A new sign in needs the password anyway, so deleting cookies does not escape the lock.

Staff accounts:
- TOTP MFA is mandatory for `editor` and `admin` (secret encrypted with the user DEK, replay guard on time step, ten single-use recovery codes). If schedule forces a cut, the minimum fallback is a unique long password plus login alerts, logged as an exception in `docs/DECISIONS.md`.
- Sensitive actions require password confirmation within 10 minutes (`reauth_at`): role change, user suspension or deletion, platform settings, theme publish, MFA reset.
- First admin is created by a CLI seed script that prompts for credentials. No default or env-provided admin password. The seed refuses to run when an admin exists.

CSRF:
- `SameSite=Lax` cookies, plus every state-changing route handler calls `assertSameOrigin()`: requires `Origin` (or `Sec-Fetch-Site: same-origin`) to match `APP_ORIGIN`, otherwise 403. Server Actions use the framework origin check plus the same helper. No state changes on GET.
- No CORS headers on API routes. They are same-origin only.

## 5. Authorization model

Authenticated is not authorized. Three layers, all required:

1. Handler layer: `requireSession()` then a named policy function.
2. Service layer: functions take an `Actor` argument and filter by it. No repository function accepts a bare client-supplied id without the actor or a policy result.
3. Database layer: RLS on profile-owned tables (DATA-MODEL.md section 10), fail closed.

Roles:

| Capability | Anonymous | viewer | editor | admin | super_admin |
|---|---|---|---|---|---|
| Landing page, sign up, sign in | yes | yes | yes | yes | yes |
| Browse, watch, search (own visible catalog) | yes, published titles only, Kids safe only in Kids mode, and only while `features.guest_play` is on (M40, D-194) | yes | yes | yes | yes |
| Manage own profiles, list, progress, import device history | no (progress stays on the device) | yes | yes | yes | yes |
| Read and mark own notices, change own notification choices and email digest, rate titles (adult profiles only, M44) | no | yes, own profile only, never on a kids profile | yes | yes | yes |
| `/admin` access | no | no | yes | yes | yes |
| Upload, edit videos, series, categories, home rows | no | no | yes | yes | yes |
| Review and approve captions | no | no | yes | yes | yes |
| Set the Home hero preview clip to automatic, a picked segment or off, retry a clip, write hero slide text (`video.edit`, M41) | no | no | yes | yes | yes |
| Generate previews for all videos, which queues hero clips for every published video (`preview.backfill`, M41, D-355) | no | no | no | yes | yes |
| Publish and unpublish | no | no | yes | yes | yes |
| Delete video (soft) | no | no | admin only | yes | yes |
| View users and profiles overview, suspend users | no | no | no | yes | yes |
| Invite staff, change roles, reset another admin's 2FA | no | no | no | no | yes (re-auth, not self) |
| Theme and platform settings | no | no | no | yes | yes |
| Features and limits, retry or discard failed jobs on System jobs, delete a viewer account at the owner request | no | no | no | no | yes |
| Retry failed encodes (one or many) | no | no | no | yes | yes |
| Bulk approve captions, set captions on or off for a video (`caption.approve_bulk`, `caption.availability`) | no | no | no | yes | yes |
| Delete a series, handle viewer accounts in bulk (`series.delete`, `users.bulk`) | no | no | no | yes | yes |
| Change roles in bulk (`roles.bulk`, re-auth once, never self) | no | no | no | no | yes |
| Read audit log | no | no | no | content actions only | yes, all entries and export |
| See donations, export them as CSV, settle a gift that needs review (`donation.view`, `donation.export`, `donation.resolve`, M48) | no | no | no | yes (email masked, full address only through an audited reveal) | yes |
| Donate, check a gift status (`POST /api/donate/checkout`, `GET /api/donate/status`, M48) | yes, when donations are on, never on a kids profile or kids mode (403) | yes, adult profiles only | yes, adult profiles only | yes, adult profiles only | yes, adult profiles only |

Rules:
- Profile ownership: any route with a profile id loads it through `getOwnedProfile(actor, id)`, which returns 404 (not 403) when the profile belongs to someone else, to avoid leaking existence.
- Kids rule: if the active profile is kids, every catalog query adds `kids_safe = true`, search results, rows, detail pages, playback session minting and the key endpoint included. Direct URL access to a non kids-safe title returns 404.
- Mass assignment: update schemas whitelist fields. `role`, `status`, `email_verified_at` are never accepted from user bodies.
- No sequential or guessable public ids: UUIDs, and slugs only for already-public catalog items.
- Do not rely on middleware for authorization. Re-check inside the handler.
- Only a Super admin can invite staff, change roles, reset another admin's 2FA, read security entries in the audit log, export it, change features and limits, retry failed jobs on the System jobs screen and delete a viewer account (D-128). Retrying a failed encode is an Editor action (`encode.retry`). The database refuses to lose the last active Super admin (trigger) and `staff_set_role` re-checks the caller in SQL. Nobody can change their own role.
- The worker role has no grants on identity tables. A compromised worker cannot read accounts.

- Guest rule (M40): a visitor with no account is a guest with an audience and nothing else. The catalog functions they reach take an audience and no actor, run in a plain transaction, and read no row level security table. Personal routes (`/api/progress`, `/api/progress/import`, `/api/my-list`, `/api/ratings`, `/api/profiles`, `/api/search/recent`, `/api/watch/progress`) stay 401 for a guest, even one with a valid guest cookie. A guest cookie is never read as a session and a forged one is ignored. Kids mode for a guest is a device cookie and a convenience, not a lock (D-234).
- The guest id is minted only by `POST /api/play/{id}/session`, after the same origin check, and only while guest play is on. Staff routes do not read it.

Every route has an authorization test with at least: anonymous, wrong role, other account's resource. The matrix for guests and accounts is `apps/web/src/server/viewer/route-matrix.int.test.ts`: public GET routes answer a guest and refuse writes with 405, personal routes answer 401 to an anonymous request and to a request that carries a guest cookie.

## 6. API and input pipeline

```
Request
  -> Cloudflare (WAF, coarse rate rules)
  -> Caddy (size limits, header hygiene)
  -> interceptor (request id, headers, coarse limit)
  -> same-origin check (state-changing)
  -> rate limit (per route policy)
  -> Zod validation (.strict())
  -> session and policy checks
  -> service (RLS context)
  -> DTO mapper
```

- Body size limits: JSON 100 KB by default, 1 MB for caption saves, enforced in Caddy and the handler.
- Responses: explicit DTOs only. Errors return a stable code and message, never stack traces, SQL or schema details. Unauthenticated requests get a clean 401 with no data.
- XSS: React escapes output. No `dangerouslySetInnerHTML` except through a single reviewed helper for sanitized content (none planned). Descriptions are plain text.
- No inbound webhooks at launch. If any are added (for example email bounces or Sentry), HMAC-SHA256 signature verification and replay protection are mandatory before processing.

## 7. Rate limits

Postgres token buckets (`rate_limit_buckets`). Keys combine route policy and subject (IP, account, profile). Cloudflare edge rules add a first layer. Values are defaults, tunable in code constants with tests.

| Route or action | Subject | Limit |
|---|---|---|
| Login | IP and email hash pair | 5 failures per 15 minutes, then a 15 minute lock for viewers (D-004, D-089), 3 failures and 30 minutes for staff. The owner gets a lockout email at most hourly |
| Login | IP | 20 failures per 15 minutes |
| Notices list, count, mark read, notification settings (M44) | Account | Same guarded budget as other viewer reads and writes. The unread count is polled at most once a minute by the bell. The one click unsubscribe route is token checked and rate limited per IP |
| Signup | IP | 5 per hour |
| Password reset request | email hash, IP | 3 per hour, 10 per hour |
| Verification resend | account | 3 per hour |
| MFA code entry | account | 5 per 10 minutes |
| Kids PIN entry | profile | 5 per 15 minutes |
| Playback session mint | profile | 60 per minute |
| Playback session mint, guest | guest id, network (keyed hash of IPv4 /24 or IPv6 /48) | 20 per minute, 120 per minute (D-197) |
| Playback challenge, guest | network (keyed hash) | 3 refusals (403 or 429) per 10 minutes, then the next guest session needs a Turnstile check. Off when Turnstile is not configured (D-238) |
| Public catalog reads (home, browse, search, titles) | IP and guest id | `api` bucket per address and per verified guest id, search on the `search` bucket (D-204) |
| History import | profile | `progress` bucket, at most 100 videos per call (D-237) |
| HLS key endpoint | profile, IP | 20 per 10 minutes, 300 per minute |
| Search | IP or account | 60 per minute |
| Progress write | profile | 30 per minute |
| Admin API (general) | account | 300 per minute |
| Upload part presign | account | 600 per minute |
| Global API | IP | 300 per minute |

Denials return 429 with `Retry-After`, and security-relevant denials write an audit entry.

## 8. Upload and media validation

Only `editor` and `admin` upload. Viewers never upload anything, which removes the largest attack surface. Profile avatars are preset ids, not files.

Video:
1. At session creation: extension allowlist (`mp4`, `mov`, `mkv`, `webm`), declared MIME allowlist, size at most `MAX_UPLOAD_BYTES`, per-creator pending upload cap, filename sanitized for display and never used in a storage key.
2. Presigned part URLs bound to exact `Content-Length`, expiring in 1 hour, scoped to one key and upload id.
3. At completion: server `ListParts` totals must equal the declared size.
4. `video.probe` in the worker: read the first bytes and check magic numbers (`ftyp` box for mp4 and mov, EBML header for matroska and webm), then `ffprobe` format must be in the allowlist, must contain a video stream, duration at most `MAX_VIDEO_SECONDS`, sane dimensions and stream count. Failure deletes the object and marks the video failed.
5. FFmpeg runs as a child process with an argument array (no shell), `-protocol_whitelist file`, forced allowlisted demuxers, resource limits, timeout, in a non-root container with a read-only root filesystem and a tmpfs scratch area, and no network route except storage and the database.
6. Originals live in a private bucket and are never served.

Images (logo, favicon, hero, thumbnail): 10 MiB cap, type sniffed with a magic byte library (not trusting extension or MIME), decoded and re-encoded by `sharp` to WebP at fixed sizes (strips EXIF and any payload), dimension limits, SVG rejected.

Captions (manual edit or upload): 1 MiB cap, strict WebVTT parse, cue text limited to plain text plus a small tag allowlist (`b`, `i`, `u`), everything else stripped. The player renders cues as text, never as HTML.

## 9. Signed URLs, playback tokens and HLS encryption

Details in ARCHITECTURE.md sections 10 and 11. Security requirements:
- AES-128 key per video, random, wrapped at rest, served only after token check, published check and rate limit, with `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
- Playback token HMAC-SHA256, 30 minute life, `kid` for rotation, constant-time comparison, binds video and profile. A guest token carries `gst` (guest) and `kd` (Kids mode) instead of a profile, is never combined with a staff preview (`pv`), and the key route checks `kd` against the video's Kids safety (D-196).
- Signed segment URLs HMAC over path and expiry, 2 hour life for accounts (D-120, which replaced the 6 hours of D-089) and 20 minutes for guests (`limits.guest_segment_minutes`, 5 to 120, D-197), verified at the edge, query ignored for caching. The edge Worker is unchanged for guests: it checks only signature and expiry.
- Secrets `PLAYBACK_TOKEN_SECRET` and `MEDIA_URL_SECRET` are different and independent of `HLS_KEK`.
- Key and playlist routes never log query strings. The `?pt=` fallback exists only for native HLS clients.
- Honest limit: this is deterrence, not DRM. Do not describe it as copy protection in user-facing text.

## 10. PII handling and crypto-shredding

PII inventory:

| Data | Where | Protection |
|---|---|---|
| Email | `accounts.email_enc`, lookup via `email_hash` | AES-256-GCM with per-user DEK, HMAC hash with pepper |
| Account and profile display names | `*_enc` columns | Per-user DEK |
| Password | `password_hash` | argon2id |
| Profile PIN | `pin_hash` | argon2id |
| TOTP secret | `mfa_factors.secret_enc` | Per-user DEK |
| IP address | sessions, audit, tokens | Truncated (IPv4 /24, IPv6 /48). Raw IP only in short-lived access logs |
| Watch history | `watch_progress`, `view_events` | Owner-only RLS. Not recorded per profile for kids |
| Ratings | `title_ratings` | Owner-only RLS per profile. Never for kids. Deleted with the profile |
| Notices | `viewer_notices` | Owner-only RLS per profile. Never created for kids. Kept 60 days, at most 100 per profile, then pruned by the worker. Deleted with the profile |
| Notification choices and digest address | `viewer_notification_prefs` | Owner-only RLS. The address is sealed with the field key (D-129) and cleared when the account email changes or the person unsubscribes. Deleted at account purge. Exported without the address |
| Help centre progress | `help_progress` | Per account: guides marked done, videos watched, one Yes or No answer to Was this helpful. Owner only RLS, no cookie and no browser storage. Deleted at account purge, listed in the data export. Nothing else is stored with it (M50). |
| Help videos, captions and pictures | `/admin/help/media/...` | Served only to a signed in staff session (401 otherwise), a fixed file name pattern per video id, no path outside its folder, `Cache-Control: private`, `X-Content-Type-Options: nosniff`, `X-Robots-Tag: noindex`, Range supported. Videos live under `help/<release>/` in the private originals bucket (or the committed placeholder set for release `sample`), never in the catalog, Home, search, sitemap, analytics or Kids (test `server/help/isolation.test.ts`). Prebuilt guide PDFs (`pdf/<ID>.pdf`) follow the same rules and download as attachments. The Help panel loads through one read only server action that needs a signed in staff session, takes a route string of at most 200 characters used only for pattern matching, and returns the guide data for the person's role (D-384). Guides read stay in memory for the visit and progress saves retry from memory (D-386): no cookie, storage key, service worker or cache is added. |
| Push subscriptions | not built (Could, M44-S16) | If built: endpoint and keys per device, generic payload, removed on sign out and at purge |
| Country | `view_events.country` | Coarse, from the CDN header |
| Sign in events | `login_events` | Country, time, outcome, short user agent and keyed device hash. Never an address. Owner-only RLS. Kept 90 days, deleted at account purge, exported without the device hash |
| Linked Google identity | `account_identities` | Provider subject, keyed email hash, masked address hint. Owner-only RLS. Deleted at account purge, exported with the masked hint only |

Design (adapting baseline section 3):
1. Each account gets a random 256-bit DEK at signup. It is wrapped with `FIELD_KEK` and stored in the separate `ad_keys` database (`user_keys`).
2. PII fields are encrypted with the DEK (AES-256-GCM, random 96-bit nonce, AAD = account id and column name) before insert. Backups of the main database contain ciphertext only.
3. `FIELD_KEK` lives only in the server environment and an offline copy held by the owner. A dump of the database without the KEK and keys DB is useless.
4. Unwrapped DEKs are cached in memory for at most 5 minutes (small LRU).
5. Deletion (viewer self-service with password confirmation, or admin request on behalf of a user): in one transaction delete profiles, progress, list, sessions, tokens, MFA, consents, null the tombstone columns and set `status = deleted`; record `account_deletions`; then destroy the DEK row. A retry job guarantees the DEK is destroyed even if the first attempt fails. `view_events.profile_id` becomes null.
6. Backups: main database backups keep ciphertext. Keys database backups are retained 14 days maximum. After that, no backup holds the DEK, so deleted accounts' ciphertext in older main backups is permanently unreadable. The privacy notice states the 14 day completion window.
7. KEK rotation: wrap each DEK with the new KEK (`kek_version`), keep `FIELD_KEK_PREVIOUS` until finished. Loss of the KEK means loss of all encrypted PII, so keep the offline copy and test recovery.
8. Search by email is by hash only. Admin user lists decrypt only the visible page, in batch.

Data minimisation: no date of birth, phone number, address or national id is collected. Kids profiles hold only a display name and an avatar preset.

## 11. Secrets handling

- Never in git. `.env*` ignored (except `.env.example` with names only). gitleaks runs as a pre-commit hook and in CI.
- Production env file lives on the VPS at `/opt/angelsdelight/.env`, owned by root, mode 600, injected into containers as environment variables. The migrate step gets the owner database URL only at deploy time.
- Least privilege credentials: web has originals-bucket access only, worker has originals and media, backups use a separate token. Each database role is separate (DATA-MODEL.md section 2).
- Logs redact `authorization`, `cookie`, `set-cookie`, `password`, `token`, `secret`, `email` (pino redact paths). Sentry has `sendDefaultPii: false` and a `beforeSend` scrubber.
- Rotation runbook for each secret is in DEPLOYMENT.md section 12. Dual-secret support exists for playback tokens, `HLS_KEK` and `FIELD_KEK`.
- `GOOGLE_CLIENT_SECRET` is a secret like the others: VPS env file only, never logged, rotate in the Google console and restart.
- Never paste real keys, internal IPs or production data into any AI session. Redact first. Treat any AI session as a public channel (baseline section 2).
- Pasted text inside code comments or dependencies that tries to instruct a reviewer or scanner is untrusted data (prompt injection).

## 12. Children, privacy and NDPR compliance notes

Product rules:
- Engagement (M44): kids profiles cannot rate, receive notices, see the bell or get the email digest, and the API answers 403 for them. Digest mail carries only generic titles from adult profiles, never what a child watched.
- Accounts are held by adults. Signup requires accepting terms and a guardian declaration (`consents`). Children use kids profiles under that account.
- Kids profile: content limited to `kids_safe`, no search outside kids-safe content, no external links, no profile management or leaving the profile without the PIN, no per-profile analytics (`view_events.profile_id` null, `audience = kids`), no personalised recommendations beyond Continue Watching stored for that profile.
- No third party ads, no third-party trackers, no social features. First party sponsor cards only (M48): still images or text served from our own origin, one link through our own `/s/{id}` redirect, no sponsor script, pixel or HTML, never on kids profiles or Kids mode (selection, click, impression, cookie and checkout code all fail closed). Donations use a hosted redirect checkout, so card data never reaches us and no payment script loads on our pages. The CSP is unchanged: no new script, frame or form origin. The player and site load no third-party scripts except optional Cloudflare Turnstile on forms and Sentry if enabled (neither loads on kids playback pages).
- Storage inventory (M45-S11): every cookie, storage key and cache is a row in `STORAGE_INVENTORY`, and a source scan fails the build on any undeclared one. The Privacy page renders the same list. Only necessary and functional storage is used, so the notice is informational and there is no consent wall.
- Analytics posture (M45-S12): analytics is first party and anonymous. Search and share events are dropped when Global Privacy Control or Do Not Track is on. A test fails if a script loads from an origin other than the allowed list (today only Cloudflare Turnstile) or if analytics code touches cookies or device storage. Adding a tracker needs a logged decision.
- Kids-only titles are never indexed: no sitemap entry, `noindex` on the page and on the share image (R26).
- Login events (M49): country, time and outcome only, no IP, deleted after 90 days and with the account. Viewing activity is the watch progress data and follows the same deletion.
- Child-friendly privacy and terms text is a client content item and stays configurable (`legal.*_version`).
- Guests (M40): a visitor without an account gets one cookie, `__Host-ad_guest` (signed, HTTP only, 180 days), set only when they start a video. It carries a random 128 bit id used for rate limits and playback tokens, nothing about the person. Analytics store a hash of that id and the Lagos day, so the stored viewer changes every day and the id itself is never stored; in Kids mode no viewer id is stored at all. Where a guest stopped in each video (up to 100 videos), the Kids mode choice (`__Host-ad_gaud`) and a pending save stay on the device, never on the server, until the visitor signs in and chooses to import. The Privacy page names the guest cookie, its purpose and its life.

Nigeria Data Protection Act 2023 (NDPA), regulator the Nigeria Data Protection Commission (NDPC). Items to confirm with counsel before launch (the previous term NDPR refers to the earlier 2019 regulation, now superseded in practice by the Act and its implementation directive):
- Registration as a data controller or processor of major importance, if the thresholds apply.
- Lawful basis: consent for account data and for processing children's data through a parent or guardian, with a reasonable verification mechanism (the guardian declaration is the minimum, confirm sufficiency).
- Privacy notice covering purposes, retention (section 10 table), rights (access, rectification, deletion, objection, portability) and contact details of the person responsible for data protection.
- Data subject requests: self-service export and deletion, and an email contact. Respond within the statutory period.
- Breach notification: assess and notify the NDPC within 72 hours of becoming aware of a breach likely to risk individuals, and notify affected people when risk is high. Runbook in section 17.
- Cross-border transfer: the VPS is in the EU (Contabo or Hetzner) and R2, Cloudflare and any email provider are abroad. Record transfers and safeguards in the privacy notice.
- Data protection impact assessment recommended because children's data is processed.
- Data minimisation and retention limits are implemented as in section 10.

## 12b. Series names (M51)

The series words are owner typed text shown to every viewer. They are validated once in `validateSeriesLabels` (1 to 24 characters, no markup characters, dashes or emoji, code 1 to 4 letters or numbers), by the settings registry for the site value and by `updateAdminSeries` for the series override, and React escapes them on output. The override column has a CHECK that it is null or an object. Only editors and above can change a series override and only admins can change the site setting. Both changes are audited (`series.labels`, and the settings audit). Nothing in this feature adds a cookie, storage key or public write.

## 12a. Languages and translations (M46)

- **Permissions.** `i18n.edit` (Editor and above), `i18n.approve` and `i18n.publish` (Admin and above), `i18n.override` (Super admin only, with a reason). Caption side: `caption.translate` (Editor and above to request, Admin to publish a language as `caption.publish_language`). An Analyst has none.
- **Nothing unreviewed reaches viewers.** Translations are drafts until an Admin approves them. Imports from a spreadsheet land In review, never Approved, so a volunteer file cannot publish anything. Sample draft catalogs load as draft rows and the baseline JSON stays empty until a native speaker has reviewed text. A caption translation is created In review and unpublished, and publishing a language is a separate audited step.
- **New routes.** `GET /api/admin/languages/[locale]/export?format=csv|json` and `POST /api/admin/languages/[locale]/import?dryRun=1`. Staff session, same origin check, body limit 2 MB and 5,000 rows. Caption routes accept a language parameter and keep their existing permission checks.
- **Text rules.** Translations are plain text. Validation requires the same placeholders as the English, the plural forms the language uses, and no em or en dashes, and normalises to NFC. Output is escaped by React like all other copy.
- **Translation engine and API key.** The provider is chosen by `TRANSLATE_PROVIDER` (default `none`, off). `TRANSLATE_API_KEY` lives only in the server environment, is sent as a header, and is never shown in the admin, logged or returned by an API. The Engine panel shows state and usage only. A hosted engine sends caption text to a third party, so the owner must add that to the privacy page before enabling it (CLIENT-INPUTS section 7). A monthly character cap refuses jobs before any call, and the fake provider and the pseudo locale are rejected in production.
- **Language cookie and storage.** `ad_locale` is a first party, same site cookie holding a language code, set only when a viewer chooses a language or follows `?lang=`. The browser also keeps `ad:locale` in local storage for the offline page. Neither holds personal data. The owner should mention them in the storage notice text. `accounts.locale` and the profile language are covered by the existing account export and deletion.
- **Missing key report.** Only the key, the locale and a hit count are stored, batched, with no viewer identifier, bots and prefetch ignored, capped per locale.
- **Mail.** Viewer mail uses the account language and falls back to English per key. Staff mail stays English.

## 13. Dependency policy

- pnpm lockfile committed. CI installs with `--frozen-lockfile`.
- Dependency lifecycle scripts blocked by default. Allowed packages are listed in `onlyBuiltDependencies` and reviewed.
- Dependency update PRs weekly (Renovate or Dependabot), grouped, with a minimum release age of 7 days (`minimumReleaseAge`) to avoid freshly compromised versions. Security advisories bypass the delay after review.
- New dependencies need a one-line justification in the PR. Prefer platform and standard library features. Check maintainer activity, download counts and name similarity (typosquatting).
- CI gates: `pnpm audit --prod` (fail on high or critical), gitleaks, Semgrep rules for JS and TS, Trivy scan of built images, CycloneDX SBOM artifact per release.
- Base images pinned by digest, rebuilt monthly or on advisories.
- Human review is mandatory for every AI-written change before merge (baseline A08).

## 14. Headers and CSP

Set by the interceptor (nonce per request) and Caddy:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{nonce}' 'strict-dynamic';
  style-src 'self' 'nonce-{nonce}';
  img-src 'self' data: blob: {MEDIA_ORIGIN};
  media-src 'self' blob: {MEDIA_ORIGIN};
  font-src 'self';
  connect-src 'self' {MEDIA_ORIGIN} {S3_UPLOAD_ORIGIN_ADMIN_ONLY};
  worker-src 'self' blob:;
  frame-src https://challenges.cloudflare.com;
  object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';
  upgrade-insecure-requests
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin   (no-referrer on key and playlist routes)
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Cross-Origin-Opener-Policy: same-origin
Cache-Control: private, no-store   (authenticated pages and API)
```

Notes: the S3 upload origin is allowed only on `/admin` routes. Fonts are self-hosted from the curated list, with no runtime font CDN. The theme style block carries the nonce. HSTS preload is a later, deliberate step. Cloudflare is set to TLS 1.3 enabled with minimum TLS 1.2, a deliberate deviation from the baseline's "enforce TLS 1.3" so older Android devices keep working (logged in DECISIONS.md). No wildcard CORS anywhere. Media bucket CORS allows only the app origin for GET and HEAD. Originals bucket CORS allows only the admin origin for PUT with exposed `ETag`.

## 15. Logging, audit and monitoring

- Application logs: pino JSON, request id, route, status, duration, actor id (not email). No bodies.
- Audit log (append-only) records at minimum: login success and failure, logout, password change and reset, MFA enrol and reset, session revoke, role change, suspension, account deletion, video create, publish, unpublish, delete, caption approve, theme publish, settings change, row curation changes, upload completion and failure, authorization denials on admin routes, rate limit denials on auth routes.
- Alerts (email or chat): login failure spikes, 5xx rate, readiness failures, failed jobs, disk above 80 percent, backup failure, certificate or domain expiry.
- Retention: access logs 14 days, application logs 30 days, audit log 24 months.

## 16. Pre-deployment checklist

```
[ ] ENVIRONMENT AND SECRETS
    [ ] .env files ignored by git, .env.example has names only
    [ ] gitleaks clean on full history
    [ ] All secrets present, unique per environment, created from a CSPRNG
    [ ] FIELD_KEK and HLS_KEK offline copies stored and a restore rehearsed
    [ ] No secrets or internal IPs pasted into AI sessions

[ ] AUTHORIZATION AND DATA ACCESS
    [ ] Authorization matrix tests pass for every route (anonymous, wrong role, other account)
    [ ] RLS enabled and forced on accounts, profiles, watch_progress, my_list
    [ ] ad_app has no DDL and no BYPASSRLS, ad_worker has no identity table grants
    [ ] Kids profile cannot reach non kids-safe titles by URL, search or key endpoint
    [ ] Last admin protection and self role change block verified
    [ ] User DEKs stored in the separate keys database, shredding tested end to end

[ ] INPUT HARDENING
    [ ] Zod .strict() on every route and Server Action
    [ ] No string-concatenated SQL
    [ ] Upload type, size and magic byte checks tested with hostile fixtures
    [ ] FFmpeg protocol whitelist and container sandbox verified
    [ ] VTT sanitization tests pass
    [ ] CORS lists only trusted origins, no wildcard

[ ] AUTH
    [ ] Cookie flags verified in a production build
    [ ] Rate limits verified for login, signup, reset, key endpoint
    [ ] Staff MFA enforced
    [ ] Email SPF, DKIM, DMARC configured and verified

[ ] STORAGE AND DELIVERY
    [ ] Originals bucket has no public access or custom domain
    [ ] Media bucket reachable only through the Edge Worker (EDGE_TOKEN_MODE=worker)
    [ ] Segment URL without or with a bad signature returns 403
    [ ] Key endpoint without token returns 401
    [ ] Bucket lifecycle aborts incomplete multipart uploads

[ ] INFRASTRUCTURE
    [ ] Headers and CSP verified with a scanner, no CSP violations in the console
    [ ] Cloudflare Full (strict), origin reachable only from Cloudflare ranges
    [ ] SSH keys only, firewall on, unattended upgrades on
    [ ] Backups run, restore rehearsed, keys DB backup retention is 14 days
    [ ] Containers non-root, images scanned, no dev routes mounted (dev-storage route absent)

[ ] PRIVACY
    [ ] Privacy notice and terms published, versions set in settings
    [ ] Account export and deletion work, deletion verified in database and keys DB
    [ ] NDPA items in section 12 reviewed with counsel

[ ] SCANS AND REVIEW
    [ ] Full pre-release scan completed (section 18) and findings triaged
    [ ] Independent human review of auth, authorization, upload and key code
    [ ] AI footprint grep clean (TDD-PROTOCOL.md)
```

## 17. Scanning cadence and incident response

Scanning (from the shared harness cadence table):

| Trigger | Frequency | Scope | Goal |
|---|---|---|---|
| Pull request | Every PR | Changed files: Semgrep, gitleaks, dependency audit, scoped tests | Block new vulnerabilities before merge |
| CI nightly | Daily | Main branch: audit, Trivy image scan, full test suite run by CI (not by a developer or agent session) | Catch deeper and multi-commit issues |
| Pre-release | Before each deploy that touches auth, authorization, upload, keys or storage; weekly before launch | Full deep sweep using the Anthropic defending-code-reference-harness, ported to this TypeScript stack with its `/customize` step | Adversarial discovery |

Harness rules: run only in an isolated Linux sandbox (Docker with gVisor), never mount `.env`, production keys or SSH keys, treat patches as proposals and review by hand, and cross-check with an independent tool or reviewer because a single AI pass can be fooled by injected comments or truncated context. A clean AI audit is never sign-off by itself.

Post-release errors (self-healing pipeline adaptation): Sentry (or GlitchTip) captures crashes. Fix proposals are advisory. Noise gate: act on an issue seen at least 3 times or affecting 2 users, and fast-track at the first occurrence for auth, upload, encoding and key routes. A proposed fix must pass the scoped tests, then a human applies it on a branch and commits it as ARKDEV after review. No bot-authored commits are merged. Use `github.dev` for browser-only edits.

Incident response:

| Step | Actions |
|---|---|
| Detect | Alerts, Sentry, user reports, audit log anomalies |
| Triage | Severity: S1 data exposure or admin takeover, S2 service down or key compromise, S3 degraded, S4 minor |
| Contain | Revoke sessions (`UPDATE sessions SET revoked_at = now()`), suspend accounts, put the site in maintenance mode, rotate the affected secret, block IPs at Cloudflare |
| Eradicate | Patch on a branch, scoped tests plus a regression test, deploy |
| Recover | Restore from backup if needed, verify integrity |
| Notify | If personal data is likely affected, notify the NDPC within 72 hours and affected users when risk is high, keep the record |
| Learn | Entry in `LESSONS.md`, update this document and tests |

Key compromise specifics: playback token or media URL secret leak means rotate the secret (dual-key window, then remove the old); `HLS_KEK` leak means re-wrap keys; leaked content keys mean run `video.rekey` for affected videos (re-encrypt segments, no transcode); `FIELD_KEK` leak means rotate the KEK and re-wrap all DEKs, and treat encrypted PII as exposed if the main database was also taken.

### 17.1 Share previews are public disclosures

A share preview is read by crawlers without a session, so it follows the signed out rules: `publicPreview` applies `maturity.guest_max_rank`, unpublished, scheduled, trashed titles answer not found, kids only titles and failed kids only lookups show the generic platform card with noindex (R26, D-389, D-390). `og:video` tags are never emitted and JSON-LD never sets `contentUrl`, because media urls are signed. Share text is cleaned of markup and control characters before it reaches a tag, and JSON-LD is escaped by `serializeJsonLd`. `pnpm share:check` guards the tags in CI.

### 17.2 Share links and share counts

The Share sheet (lane L15a) uses plain links, `mailto:`, `sms:` and the Web Share API. No third party script, pixel or SDK is loaded, so no sharing site learns anything until the viewer chooses it. The shared link is built from the slug alone (`canonicalShareUrl`), never from the address bar, so a session, signed or tracking value on the current page can never end up in a link. Web channels open with `rel="noopener noreferrer"`. A title that must not be shared (kids only, or a failed lookup) and every kids profile get no Share control. The `share` analytics event carries only the place and whether it was a video or a series; the schema is strict so a link, title or id is rejected, and the event is dropped under Global Privacy Control and Do Not Track.

## 18. Residual risks

| Id | Risk | Decision |
|---|---|---|
| R-1 | Single VPS, single point of failure | Accepted. 24 hour RPO, documented restore. |
| R-2 | No DRM, content can be captured | Accepted per brief. |
| R-3 | Playback token in query for native HLS fallback can leak through logs or referrers | Accepted for that fallback only, mitigated by redaction, no-referrer and short life. |
| R-4 | Hand-written auth | Mitigated by tests, independent scan, minimal surface. |
| R-5 | In-memory DEK cache delays shredding on other processes up to 5 minutes | Accepted. |
| R-6 | CPU-bound hashing and encoding on the same VPS | Mitigated by concurrency caps and limits. |

## 19. Knowledge base recording rules

The recorder (`scripts/kb-recorder`) drives a real browser through the admin screens, so it follows these rules.

- Demo only. It runs against a fixture or demo stack with the fake dataset, never production or a real database. The origin guard accepts only localhost, 127.0.0.1, [::1] or the reserved `KB_DEMO_HOST`. The database guard accepts only `ad_kb` and `ad_kb_keys`. Both refuse before any browser opens.
- The demo reset route (`/api/kb-demo/reset`) exists only when `KB_DEMO=on`, needs the `x-kb-demo` header and answers only local requests.
- `bypassCSP` is set on the recording browser context only, because the overlay needs inline styles. It is never set in the app and never pointed at a real site.
- Every capture is scanned. A real looking email, a key or token shape, a phone number or a public IP fails the capture, and the finding is masked in anything that is kept.
- Demo accounts use reserved example domains. CI for the recorder uses no secrets and no repository variables.
- Published media sits in private object storage under `help/<release>/` and is served only to signed in staff by the help media route.

