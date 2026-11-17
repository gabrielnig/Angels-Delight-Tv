# Lane K3: admin integration

Replaces the fixture admin data with real services. `adminDataMode()` is real by default and is fixture only under `NODE_ENV=test` or `ADMIN_DATA=fixture` (D-076). Production refuses fixtures.

## What exists

| Area | Where | Notes |
|---|---|---|
| Videos, trash, series, categories, home curation | `packages/catalog/src/admin/*` (exported from `@ad/catalog`) | `(ctx, actor, ...)`, run in `withAccount`, audit row in the same transaction (D-070) |
| Web adapters | `apps/web/src/lib/data/admin/real/*` | One per service, joined to the fixture by `delegating(fixture, real)` in `services.ts` |
| Jobs and storage | `real/system.ts` | Over the `jobs` mirror and catalog records (D-077) |
| Captions list and review | `real/captions.ts`, `usePreviewClock` | Lane D `CaptionService`; review playhead is the real player on a preview session (D-083) |
| Users and suspension | `real/people.ts`, migration 0013 | `staff_set_account_status`; sessions revoked and audit written (D-071) |
| Staff, invites, roles | `real/people.ts`, `ReauthDialog.tsx` | `StaffService`; `reauth: true` on a command result opens the password dialog (D-085) |
| My account, 2FA reset | `real/account.ts`, migration 0017 | Display names sealed in `display_name_enc`; codes instead of passwords (D-086) |
| Runtime | `apps/web/src/server/admin/runtime.ts` | `db`, `ctx`, `enqueue`, `captions`, `names`, `auth`, `meta`, `now`, `setSession`. Tests install fakes with `setAdminRuntime` |
| Turnstile | `server/auth/turnstile.ts`, `TurnstileWidget.tsx` | Viewer sign in, sign up and admin sign in; off without both keys; fails closed (D-087) |
| Staff preview | `/admin/videos/[id]/preview` | Real player on `POST /api/play/{id}/session` with `{preview:true}`; fixtures keep `/watch/:id` |
| Real 403 | `forbidden()` plus `app/admin/(shell)/forbidden.tsx`, `experimental.authInterrupts` | |
| Session warning | `SessionExpiryWarning.tsx`, `app/admin/session-actions.ts` | Two minutes before the 30 minute idle limit |

## Routes and exports

Routes added: `/admin/videos/[id]/preview`. Server actions: `reauthenticateAction`, `resetTwoFactorAction` (roles), `extendSessionAction` (admin). Changed signatures: `AccountService.changePassword(actor, current, next, confirm, code)`, `AccountService.regenerateCodes(actor, code)`, `PeopleService` gained `reauthenticate` and `resetTwoFactor`. Migrations 0012, 0013, 0015, 0017.

## Scoped tests

```
TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres \
pnpm vitest run packages/catalog/src/admin apps/web/src/lib/data/admin/real
pnpm vitest run apps/web/src/server/auth/turnstile.test.ts apps/web/src/server/auth/gateway.test.ts
pnpm vitest run apps/web/src/components/admin apps/web/src/components/auth
```

The fixture e2e smoke needs `ADMIN_DATA=fixture AUTH_FIXTURES=on`.

## Design review

Walked the checklist over all admin components, `admin.css` and the auth forms: no hardcoded colours or fonts, no dashes or emojis, no removed outlines, hover inside `(hover: hover)`, reduced motion covered, buttons at the touch target token. Notes: the roles table gains a Reset button in the 2FA cell, which is tight at 360px (the table scrolls); the Turnstile frame is Cloudflare's and cannot be themed.

## Gaps

- Purge is queued and the worker deletes. A series row on Home is snapshotted at publish time. `list` is capped at 5000 videos. Storage totals exclude orphan objects.
- Caption autosave stores a revision per pause (D-083).
- Real upload creation belongs to K2's upload API; `createFromUpload` throws in real mode.
- Role changes read the current role first, so the optimistic lock only covers the gap between that read and the write.
- The session warning counts page changes as activity, not typing or API polling.
- `authInterrupts` is experimental in Next 16. Turnstile was not exercised against Cloudflare (verified with a fake fetch).
- Audit and analytics read real data already; invites show "a former admin" when the inviter is no longer staff.
