# Lane B: auth and accounts

Modules M01 Auth, M02 Accounts, M12 Admin auth and roles, M21 email sending, M23 security primitives.

## Packages and exports
- `@ad/security`: `RateLimiter` (consume, peek, enforce), `LockoutStore`, `AuditWriter` (never throws, strips secrets), `assertSameOrigin`, `buildCsp`, `buildSecurityHeaders`, `clientIp`, `truncateIp`, `RATE_POLICIES`, `LOCKOUT_POLICIES`.
- `@ad/mailer`: `Mailer` (verify, already registered, reset, password changed, lockout, admin invite, email change, two factor reset, staff lockout alert, account deleted), `SmtpTransport`, `MemoryTransport`, templates with plain text and HTML.
- `@ad/auth`: `AccountService` (viewer flows) and `StaffService` (adds staff sign in, TOTP enrolment and verification, recovery codes, invites, role changes), `SessionService`, `KeyService`, `PasswordHasher`, `seedFirstAdmin`, guards `assertStaff` and `assertAdmin`. `@ad/auth/policy` is client safe. `@ad/auth/testing` holds the harness.
- Web: `apps/web/src/server/auth` (runtime singleton, cookies, session helpers, gateway, account repository, admin helpers), `apps/web/src/proxy.ts`.

## Routes and screens
Viewer screens S01 to S07 and S27 to S30 are the lane E screens, now served by `RealAuthGateway` and `RealAccountRepository` through `getAuth()` and `getAccount()`. Admin: `/admin/login`, `/admin/login/2fa` (enrolment with QR, recovery code entry), `/admin/invite/[token]`. Sign out is the existing shell action.

## Behaviour worth knowing
- Cookie `__Host-ad_session` (plain `ad_session` over http in development): HttpOnly, Secure, SameSite=Lax, Path=/. Only the SHA-256 of the token is stored.
- Viewer sessions: 30 days idle, 90 absolute. Staff: 30 minutes idle, 8 hours. Pending second factor: 10 minutes.
- Sign up, resend and reset answer identically for known and unknown addresses, and mail goes out in the background where timing could leak.
- Lockouts: viewers 5 failures per 15 minutes locks 15 minutes, staff 3 failures locks 30 minutes, second factor codes 5 per 15 minutes.
- Account deletion destroys the account key (see D-052). `AccountService.destroyPendingKeys` retries failed destruction.
- Seed: `pnpm db:seed:admin` creates the first admin from env variables and refuses to run when an admin exists.

## Tests
- `pnpm vitest run packages/security packages/mailer`
- `TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm vitest run packages/auth`
- `pnpm vitest run apps/web/src/server/auth`

## Environment
`FIELD_KEK`, `EMAIL_HASH_PEPPER`, `KEYS_DATABASE_URL`, `SMTP_URL`, `EMAIL_FROM`, `TRUSTED_PROXY_MODE`, `DEV_SKIP_MFA` (rejected in production), plus `KEYS_DATABASE_URL_SHRED`, `CSP_REPORT_ONLY`, `SUPPORT_EMAIL`, `AUTH_FIXTURES` (see D-056).

## Decisions
D-051 to D-057.

## Gaps
- Turnstile verification on sign in and sign up is not wired (the gateway has no challenge step yet).
- No admin screen for roles, invites list and two factor reset: the service methods exist (`listStaff`, `createInvite`, `changeRole`, `resetTwoFactor`) with tests, but there is no page.
- Staff password change and recovery code regeneration have service methods and no page.
- Viewer data export (M02-S05), the 14 day deletion grace period, playback settings and profiles on real accounts wait for the viewer data integration.
- The proxy sets no global API rate limit (Cloudflare does).
