# Security review (lane J1)

Independent review of `main` at the time of writing, against `docs/SECURITY.md` and the shared SECURITY-BASELINE (STRIDE, OWASP Top 10, pre-deployment checklist). The reviewer did not write the code. Earlier lane notes were not trusted: every item below was checked in code, and fixes were written test first (failing adversarial test, then the change).

Method: read auth, sessions, staff, viewer, playback, upload, edge, theme, config, logging and DB migrations end to end; ran `pnpm audit`; ran the viewer IDOR and RLS integration suites; wrote new adversarial tests. Not done: a hostile media fixture run, gitleaks and Semgrep (not installed here), production header scan, Cloudflare and VPS checks (nothing deployed).

## Summary

| Rank | Count | Status |
|---|---|---|
| High | 1 | fixed |
| Medium | 6 | 5 fixed, 1 partly fixed (M-1) |
| Low | 14 | open, listed below |

## High

### H-1 Failed crypto shredding was never retried
- Location: `packages/auth/src/accounts.ts` (`destroyPendingKeys`), no caller anywhere.
- Risk: if the keys database was down, or the process died between the deletion transaction and the shred, the account key stayed forever. Ciphertext in backups of a "deleted" account then stayed readable, breaking the erasure promise in SECURITY.md section 10 ("a retry job guarantees the DEK is destroyed").
- Fix: `apps/web/src/instrumentation.ts` starts `startShredRetry` (every 15 minutes, no overlap, production only). It runs in web because only web can read `account_deletions` and reach the keys database. Production config now also requires `KEYS_DATABASE_URL_SHRED` (see M-3).
- Status: fixed (PRs shred-retry, config-logging). Tests: `apps/web/src/server/auth/shred-retry.test.ts`.

## Medium

### M-1 Kids gate could be skipped with a client chosen profile id
- Location: `packages/viewer/src/profiles.ts` (`selectProfile`), `packages/video/src/playback/service.ts` and `http.ts` (`startSession`), viewer API.
- Risk: the signed active profile cookie was only a hint. A child on a kids profile could POST `/api/profiles/{grown-up id}/select`, or ask for a playback session with a grown-up `profileId` in the body, and get non kids-safe video and its key.
- Fix: select refuses to leave a kids profile (`kids_gate`), and a playback session refuses a profile that differs from an active kids profile. Tests: `packages/viewer/src/adversarial.int.test.ts`, `packages/video/src/playback/service.test.ts`.
- Residual (open): the cookie is client controlled. Deleting it, then picking a grown-up profile that has no PIN, still works. A real boundary needs the kids lock stored server side on the session, cleared only by the account password. Owner question below.
- Status: partly fixed.

### M-2 Password oracle without a rate limit in profile update
- Location: `packages/viewer/src/profiles.ts` (`updateProfile`, PIN change or leaving kids).
- Risk: with a stolen session cookie, `PATCH /api/profiles/{id}` with a `password` field checked the account password with no counter and no lockout, so the password could be guessed offline-speed online.
- Fix: every check first spends the `kids_exit` budget (5 per 15 minutes per account), shared with exit kids so the two routes cannot double the guesses. Tests in `adversarial.int.test.ts`.
- Status: fixed.

### M-3 Production could run without a trusted proxy
- Location: `packages/config/src/env.ts`, `packages/security/src/ip.ts`.
- Risk: with `TRUSTED_PROXY_MODE=none` (the default) the client address is null, so every per IP limit shares one bucket. Twenty bad sign ins by anyone lock sign in for everybody for 15 minutes, and signup is capped at 5 per hour site wide.
- Fix: production now rejects any mode but `cloudflare`, a missing shred connection, and two secrets with the same value (`FIELD_KEK`, `EMAIL_HASH_PEPPER`, `HLS_KEK`, `PLAYBACK_TOKEN_SECRET`, `MEDIA_URL_SECRET`). D-084.
- Status: fixed.

### M-4 Vulnerable nodemailer and no dependency gate in CI
- Location: `packages/mailer/package.json`, `.github/workflows/ci.yml`.
- Risk: nodemailer 7 had 4 high and 15 moderate advisories (header and SMTP command injection, ReDoS, TLS validation). Recipients are validated and transport config is trusted, so exposure was limited, but SECURITY.md section 13 requires a clean `pnpm audit --prod`.
- Fix: upgraded to 10.6, mailer tests pass, `pnpm audit --prod` reports none, and CI runs `pnpm audit --prod --audit-level=high`.
- Status: fixed.

### M-5 Emails could reach the logs
- Location: `packages/shared/src/logger.ts`.
- Risk: SECURITY.md section 11 requires `email` redaction. Redaction was by key name only and `email` was not in the list, and SMTP errors (`String(error)`) carry recipient addresses.
- Fix: `email` keys are redacted and addresses are masked inside every string, message and error text.
- Status: fixed.

### M-6 Global API limit existed but was never enforced
- Location: `packages/security/src/policies.ts` (`globalApiIp`, `adminGeneral` unused), viewer API guard.
- Risk: any signed in account could flood browse, home, title, profile and list routes without limit.
- Fix: the viewer API spends 300 per minute per account before any handler (new `api` bucket). Test: `apps/web/src/server/viewer/api-limit.test.ts`.
- Residual: `adminGeneral` (300 per minute) is still unused. Admin actions are being rewired by K3, so it is left for that lane.
- Status: fixed for viewers, open for admin (see L-10).

## Low (open)

| Id | Location | Risk | Fix |
|---|---|---|---|
| L-1 | `apps/web/src/server/viewer/runtime.ts` | Viewer API acts with the session role, so an admin with a password only session runs viewer calls with the admin read policy. Queries filter by account explicitly, so no leak found. | Always act as `viewer`, like `viewerActor`. |
| L-2 | migration 0011 and 0013 (`staff_set_role`, `staff_set_account_status`) | The functions trust the `p_actor` argument, not the RLS context, so they are weaker than their comment claims. | Require `p_actor = app_account_id()` and call inside `withAccount`. |
| L-3 | `packages/video/src/playback/service.ts` | Signed segment urls last 6 hours, SECURITY.md says 2. | Default 2 hours, or document the change. |
| L-4 | `apps/edge/src/handler.ts` | `cap/` and `img/` are served unsigned. Captions of unpublished videos are readable by anyone who knows the key. | Sign `cap/` too, or confirm keys are unguessable. |
| L-5 | `packages/video/src/upload/service.ts` | Pending upload cap is 20, doc says 5. | Align. |
| L-6 | `packages/auth/src/accounts.ts` | Staff can sign in through the viewer form, so they get 5 tries per 15 minutes on top of the 3 per 30 minute admin lock. | Refuse staff roles in viewer sign in, or share one lock key. |
| L-7 | `sessions.ts`, `service.ts` | Promotion or demotion between staff roles does not revoke sessions. A playback token outlives sign out for up to 30 minutes. | Revoke on any role change. Accepted risk R-3 for tokens. |
| L-8 | `packages/security/src/headers.ts` | CSP `report-uri /api/csp-report` has no route. | Add the route or drop the directive. |
| L-9 | `apps/web/src/proxy.ts` | Inbound `x-request-id` is echoed unvalidated. | Reuse the `requestIdFrom` check. |
| L-10 | admin server actions | No per account admin API limit (`adminGeneral`). Several admin services are still fixtures. | Wire the limit when K3 lands real data. |
| L-11 | CI and Docker | No gitleaks, Semgrep, Trivy or SBOM, no `minimumReleaseAge`, base images not pinned by digest. Dev only advisories remain (`picomatch`, `esbuild`). | Add the scanners from SECURITY.md section 17. |
| L-12 | `packages/auth/src/accounts.ts` (`verifyCode`) | Unknown email answers `invalid` at once, a known one may answer `too_many`, a small timing and status oracle. | Return one status for both. |
| L-13 | `packages/security/src/policies.ts` | Viewer sign in hard locks after 5 failures (D-004), while SECURITY.md section 7 says no hard lockout to avoid locking a victim out. | Decide and align the document. |
| L-14 | `apps/web/src/server/viewer/api.ts` | The viewer CSRF check accepts a request with no Origin and no Sec-Fetch-Site, or `same-site`. SameSite=Lax and the browser always sending Origin on POST make this hard to use. | Use the strict `assertSameOrigin` already used by the video routes. |

## Checked and found sound

- Sessions: random 256 bit token, only the hash stored, idle and absolute expiry, MFA flag per session, rotation on promotion, revoke on password change and reset. `__Host-` cookie flags correct.
- Passwords and tokens: argon2id with concurrency cap and dummy hash, reset and verification tokens hashed, single use, six digit codes keyed and attempt capped, TOTP replay guard, recovery codes capped.
- Enumeration: signup, reset and resend answer the same for known and unknown addresses (except L-12).
- IDOR and RLS: the existing suite plus the admin role cases pass. Foreign profile ids answer 404, RLS hides `watch_progress`, `my_list` and `search_history` from other accounts, kids rules apply in queries.
- Edge Worker: signature over key and expiry, constant time compare, key allowlist and traversal checks, signature checked before the cache, rotation supported.
- Playback token: HMAC with key id, constant time, binds video and profile, key route re-checks profile and kids rule, rate limited, `no-store`.
- Uploads: staff only, extension and MIME and size checks, filename never in a key, presigned parts bound to length, size verified at completion, magic bytes and `-protocol_whitelist file` in the worker, argument arrays without a shell.
- Theme and HTML: allowlist sanitiser rebuilds output from tokens, theme CSS is built from validated tokens, no raw CSS.
- Secrets: `.env*` ignored and in `.dockerignore`, no key material in history (grep), `DEV_SKIP_MFA` and fixture auth cannot run in production, install scripts limited to `esbuild`, `sharp`, `unrs-resolver`.
- Production only routes: dev storage and dev media answer 404 unless the local driver runs outside production.

## Most urgent open question

Should the kids lock move server side (stored on the session, cleared only by the account password), or is a PIN on every grown-up profile the accepted protection? Until one is chosen, M-1 stays partly open.
