# Security review (lane J1)

Independent review of `main` at the time of writing, against `docs/SECURITY.md` and the shared SECURITY-BASELINE (STRIDE, OWASP Top 10, pre-deployment checklist). The reviewer did not write the code. Earlier lane notes were not trusted: every item below was checked in code, and fixes were written test first (failing adversarial test, then the change).

Method: read auth, sessions, staff, viewer, playback, upload, edge, theme, config, logging and DB migrations end to end; ran `pnpm audit`; ran the viewer IDOR and RLS integration suites; wrote new adversarial tests. Not done: a hostile media fixture run, gitleaks and Semgrep (not installed here, a grep scan was added by lane J4), production header scan (`scripts/check-headers.sh` is ready, nothing is deployed to run it against), Cloudflare and VPS checks (nothing deployed).

## Summary

| Rank | Count | Status |
|---|---|---|
| High | 1 | fixed |
| Medium | 6 | fixed |
| Low | 14 | 8 fixed (L-1, L-2, L-6, L-7, L-8, L-9, L-10, L-14), 1 partly fixed (L-11), 5 closed without a code change with the reason recorded (L-3, L-4, L-5, L-12, L-13) |

## High

### H-1 Failed crypto shredding was never retried
- Location: `packages/auth/src/accounts.ts` (`destroyPendingKeys`), no caller anywhere.
- Risk: if the keys database was down, or the process died between the deletion transaction and the shred, the account key stayed forever. Ciphertext in backups of a "deleted" account then stayed readable, breaking the erasure promise in SECURITY.md section 10 ("a retry job guarantees the DEK is destroyed").
- Fix: `apps/web/src/instrumentation.ts` starts `startShredRetry` (every 15 minutes, no overlap, production only). It runs in web because only web can read `account_deletions` and reach the keys database. Production config now also requires `KEYS_DATABASE_URL_SHRED` (see M-3).
- Status: fixed (PRs shred-retry, config-logging). Tests: `apps/web/src/server/auth/shred-retry.test.ts`.

## Medium

### M-1 Kids gate could be skipped with a client chosen profile id
- Location: `packages/viewer/src/profiles.ts` (`selectProfile`), `packages/video/src/playback/service.ts` and `http.ts`, viewer API guard, `packages/auth/src/sessions.ts`.
- Risk: the signed active profile cookie was only a hint. A child on a kids profile could select a grown-up profile, name one in any request, or delete the cookie, and reach non kids-safe video and its key.
- Fix: the lock is now server side. Migration 0018 adds `sessions.active_profile_id` and `kids_locked`. Selecting a kids profile sets the lock. While it holds, the viewer API guard refuses any `profileId` (query or body) other than the locked one, select refuses a grown-up profile, profile management is refused, the playback session refuses any other profile, and the cookie is ignored. Only exit kids mode with the account password clears it (rate limited, M-2). D-088.
- Tests: `apps/web/src/server/viewer/api-kids-lock.int.test.ts` (deleted cookie, forged cookie, forged profile id in read and write, wrong password, replay on the same session), `packages/auth/src/sessions.int.test.ts` (persistence, foreign profile refused, no leak to a new session), `packages/viewer/src/adversarial.int.test.ts`, `packages/video/src/playback/service.test.ts`.
- Status: fixed. Limit: a locked session that is still signed in is protected. A child who knows the account password, or a device already signed in without a kids lock, is out of scope.

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
- Admin fix (lane J4): `adminGeneral` (300 per minute per staff account) is now spent by `getActor` in the request auth path (every `/api/admin/*` route), by `requireActionActor` in every admin server action file, and by the audit log export. Over the limit a route answers 429 with Retry-After, an action throws `RateLimited`. Tests: `apps/web/src/server/admin/budget.test.ts` (also fails if any actions file goes back to the unbudgeted `requireActor`), `request-auth.test.ts`.
- Residual: admin pages (reads) are not counted, only writes and API calls. A server action over the limit shows the generic error page, not an inline message. Fixture mode has no limiter.
- Status: fixed.

## Low

| Id | Location | Risk | Status |
|---|---|---|---|
| L-1 | `apps/web/src/server/viewer/runtime.ts` | Viewer API acted with the session role, so an admin ran viewer calls with the admin read policy. | Fixed. `viewerActorFor` always returns role `viewer`. Test: `server/viewer/role.test.ts`. |
| L-2 | migrations 0011 and 0013 | `staff_set_role` and `staff_set_account_status` trusted the `p_actor` argument. | Fixed. Migration 0019 requires `p_actor = app_account_id()`, and `changeRole` runs inside `withAccount`. Test: `packages/auth/src/staff.int.test.ts` (L-2 case). |
| L-3 | `packages/video/src/playback/service.ts` | Signed segment urls last 6 hours, SECURITY.md said 2. | Not changed, document aligned (D-089). Reason: the variant playlist is signed once, so a 2 hour life breaks a paused or long video, and every segment is AES-128 encrypted with a key that needs a live playback token, so a leaked segment url alone gives nothing. Residual: an unencrypted segment url works for up to 6 hours. |
| L-4 | `apps/edge/src/handler.ts` | `cap/` and `img/` are served unsigned. | Not changed (D-089). Reason: keys carry an 80 bit random `media_prefix` (`mediaPrefix()`) or an asset id plus a content hash, so they cannot be guessed, and captions and posters are not secret once a video is published. Residual: a caption url a viewer saw stays valid after unpublish until the files are deleted (cached immutable). Revisit if captions ever hold private content. |
| L-5 | `packages/video/src/upload/service.ts` | Pending upload cap is 20, doc said 5. | Not changed, document aligned to 20 (D-089). Reason: uploads are staff only and a batch of lessons is normal for the client. Residual: one staff account can hold 20 open multipart uploads. |
| L-6 | `packages/auth/src/accounts.ts` | Staff could sign in through the viewer form. | Fixed. A staff account with the right password gets `use_admin_login` and a redirect to `/admin/login`, with no session. A wrong password answers like any other account, so existence is not leaked. Tests: `signin.int.test.ts`, `server/auth/gateway.test.ts`. Residual: a staff email still has 5 viewer form tries plus 3 admin tries per window. Sharing one lock would make the lock threshold a role oracle, so the two stay separate. |
| L-7 | `staff.ts` | A role change did not end sessions. | Fixed. Any change of role revokes all sessions of the target. Test: `staff.int.test.ts`. The 30 minute playback token residual stays accepted (R-3). |
| L-8 | `packages/security/src/headers.ts` | CSP `report-uri` had no route. | Fixed. `/api/csp-report` takes at most 8 KB, logs an allowlisted summary with urls cut to their origin, answers 204. Test: `lib/security/csp-report.test.ts`. |
| L-9 | `apps/web/src/proxy.ts` | Inbound `x-request-id` echoed unvalidated. | Fixed. The proxy uses `requestIdFrom`. Test: `proxy.test.ts`. |
| L-10 | admin server actions | No per account admin limit. | Fixed with M-6. |
| L-11 | CI and Docker | No scanners, no release age, images not pinned. | Partly fixed. Added `scripts/secret-scan.sh` (plain grep, gitleaks is not installable here) as a CI step, `scripts/check-headers.sh` for production, and pnpm `minimumReleaseAge` of one day. Still open: Semgrep, Trivy, SBOM, base image digests (need network and a registry decision), dev only advisories (`picomatch`, `esbuild`). |
| L-12 | `accounts.ts` (`verifyCode`) | Unknown or already verified email answers `invalid` always, a fresh one answers `too_many` after the attempts. | Not changed. Reason: collapsing to one status removes the "code expired" and "too many tries" help that story M01-S03 requires. The probe needs a signup for the target address (5 per hour per IP), a Turnstile pass, and five wrong codes, and it reveals only whether an address already has an account. Residual: a patient attacker can still tell new from existing addresses at about one address per signup budget. Owner choice: accept, or collapse to one message. |
| L-13 | `policies.ts` | Viewer sign in hard locks after 5 failures, SECURITY.md said no hard lockout. | Document aligned to D-004 (D-089). Reason: the lock is 15 minutes, the owner gets a lockout email at most hourly, and the per IP limit alone does not stop a distributed guess against one account. Residual: someone who knows an address can lock that person out of sign in for 15 minutes at a time. |
| L-14 | `apps/web/src/server/viewer/api.ts` | Origin check accepted a missing Origin or `same-site`. | Fixed. The guard uses `assertSameOrigin` for every method that is not GET, HEAD or OPTIONS, whatever the route flag says. Test: `server/viewer/origin.test.ts`. `/api/analytics` stays open on purpose, it is anonymous and writes no account state. |

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

## Open work

- Run `scripts/check-headers.sh https://<production host>` after the first deploy and keep it in the release checklist.
- L-11 leftovers: Semgrep, Trivy, SBOM and base image digests.
- Owner choice on L-12 (see the table).
