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

| Capability | Anonymous | viewer | editor | admin |
|---|---|---|---|---|
| Landing page, sign up, sign in | yes | yes | yes | yes |
| Browse, watch, search (own visible catalog) | no | yes | yes | yes |
| Manage own profiles, list, progress | no | yes | yes | yes |
| `/admin` access | no | no | yes | yes |
| Upload, edit videos, series, categories, home rows | no | no | yes | yes |
| Review and approve captions | no | no | yes | yes |
| Publish and unpublish | no | no | yes | yes |
| Delete video (soft) | no | no | admin only | yes |
| View users and profiles overview, suspend users | no | no | no | yes |
| Change roles | no | no | no | yes (re-auth, not self) |
| Theme and platform settings | no | no | no | yes |
| Read audit log | no | no | no | yes |

Rules:
- Profile ownership: any route with a profile id loads it through `getOwnedProfile(actor, id)`, which returns 404 (not 403) when the profile belongs to someone else, to avoid leaking existence.
- Kids rule: if the active profile is kids, every catalog query adds `kids_safe = true`, search results, rows, detail pages, playback session minting and the key endpoint included. Direct URL access to a non kids-safe title returns 404.
- Mass assignment: update schemas whitelist fields. `role`, `status`, `email_verified_at` are never accepted from user bodies.
- No sequential or guessable public ids: UUIDs, and slugs only for already-public catalog items.
- Do not rely on middleware for authorization. Re-check inside the handler.
- Admin cannot demote or delete the last admin, and cannot change their own role.
- The worker role has no grants on identity tables. A compromised worker cannot read accounts.

Every route has an authorization test with at least: anonymous, wrong role, other account's resource.

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
| Signup | IP | 5 per hour |
| Password reset request | email hash, IP | 3 per hour, 10 per hour |
| Verification resend | account | 3 per hour |
| MFA code entry | account | 5 per 10 minutes |
| Kids PIN entry | profile | 5 per 15 minutes |
| Playback session mint | profile | 60 per minute |
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
- Playback token HMAC-SHA256, 30 minute life, `kid` for rotation, constant-time comparison, binds video and profile.
- Signed segment URLs HMAC over path and expiry, 6 hour life (D-089), verified at the edge, query ignored for caching.
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
| Country | `view_events.country` | Coarse, from the CDN header |

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
- Never paste real keys, internal IPs or production data into any AI session. Redact first. Treat any AI session as a public channel (baseline section 2).
- Pasted text inside code comments or dependencies that tries to instruct a reviewer or scanner is untrusted data (prompt injection).

## 12. Children, privacy and NDPR compliance notes

Product rules:
- Accounts are held by adults. Signup requires accepting terms and a guardian declaration (`consents`). Children use kids profiles under that account.
- Kids profile: content limited to `kids_safe`, no search outside kids-safe content, no external links, no profile management or leaving the profile without the PIN, no per-profile analytics (`view_events.profile_id` null, `audience = kids`), no personalised recommendations beyond Continue Watching stored for that profile.
- No advertising, no third-party trackers, no social features. The player and site load no third-party scripts except optional Cloudflare Turnstile on forms and Sentry if enabled (neither loads on kids playback pages).
- Child-friendly privacy and terms text is a client content item and stays configurable (`legal.*_version`).

Nigeria Data Protection Act 2023 (NDPA), regulator the Nigeria Data Protection Commission (NDPC). Items to confirm with counsel before launch (the previous term NDPR refers to the earlier 2019 regulation, now superseded in practice by the Act and its implementation directive):
- Registration as a data controller or processor of major importance, if the thresholds apply.
- Lawful basis: consent for account data and for processing children's data through a parent or guardian, with a reasonable verification mechanism (the guardian declaration is the minimum, confirm sufficiency).
- Privacy notice covering purposes, retention (section 10 table), rights (access, rectification, deletion, objection, portability) and contact details of the person responsible for data protection.
- Data subject requests: self-service export and deletion, and an email contact. Respond within the statutory period.
- Breach notification: assess and notify the NDPC within 72 hours of becoming aware of a breach likely to risk individuals, and notify affected people when risk is high. Runbook in section 17.
- Cross-border transfer: the VPS is in the EU (Contabo or Hetzner) and R2, Cloudflare and any email provider are abroad. Record transfers and safeguards in the privacy notice.
- Data protection impact assessment recommended because children's data is processed.
- Data minimisation and retention limits are implemented as in section 10.

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

## 18. Residual risks

| Id | Risk | Decision |
|---|---|---|
| R-1 | Single VPS, single point of failure | Accepted. 24 hour RPO, documented restore. |
| R-2 | No DRM, content can be captured | Accepted per brief. |
| R-3 | Playback token in query for native HLS fallback can leak through logs or referrers | Accepted for that fallback only, mitigated by redaction, no-referrer and short life. |
| R-4 | Hand-written auth | Mitigated by tests, independent scan, minimal surface. |
| R-5 | In-memory DEK cache delays shredding on other processes up to 5 minutes | Accepted. |
| R-6 | CPU-bound hashing and encoding on the same VPS | Mitigated by concurrency caps and limits. |
