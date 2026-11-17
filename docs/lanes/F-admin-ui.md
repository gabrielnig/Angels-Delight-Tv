# Lane F: Admin UI

Screens S38 to S66 except theme and site settings (lane H). All code is in `apps/web`.

## Routes

| Route | Screen | Needs |
|---|---|---|
| `/admin` | Dashboard | editor |
| `/admin/videos`, `/admin/videos/[id]`, `/admin/videos/[id]/poster`, `/admin/videos/trash`, `/admin/videos/upload` | Videos, edit and checklist, poster picker, trash, upload | editor (purge and delete need admin) |
| `/admin/encoding` | Encoding queue | editor |
| `/admin/captions`, `/admin/captions/[videoId]` | Caption list and review | editor |
| `/admin/series`, `/admin/series/[id]`, `/admin/categories` | Series and categories | editor |
| `/admin/home` | Home curation with live preview | editor |
| `/admin/users`, `/admin/users/[id]`, `/admin/roles` | Users, roles and invites | admin |
| `/admin/audit-log`, `/admin/audit-log/export` | Audit log and CSV | admin |
| `/admin/analytics`, `/admin/analytics/[id]`, `/admin/analytics/export` | Analytics | editor |
| `/admin/account`, `/admin/system` | My account, system | any staff, admin |

## Exported modules

- `lib/admin/can.ts`: `can(role, action)`, `canAny`, `requiredRole`, `ADMIN_ACTIONS`. `can-labels.ts` gives plain names. The matrix mirrors SECURITY.md section 5 and fails closed.
- `lib/admin/cues.ts`: caption cue parsing, validation warnings, split, merge, find and replace, undo history, `.vtt` read and write. `poster-rules.ts`: poster file checks and focus maths.
- `lib/uploader`: `createUploader`, `UploadTransport`, `createFakeTransport`, `createSimulatedTransport`, `createHttpTransport`. Defaults: 2 files at once, 3 parts per file, 4 automatic tries with backoff. A failed file never blocks the others and retry resumes from server truth.
- `lib/data/admin/services.ts`: `videoService`, `dashboardService`, `captionService`, `collectionService`, `homeService`, `peopleService`, `auditService`, `analyticsService`, `accountService`, `systemService`. Pure command modules sit beside it (`*-commands.ts`, `*-rules.ts`) so rules are tested without React.
- `components/admin`: shell, `Button`, `Badge`, `Dialog`, `ConfirmDialog`, `Toast`, fields, `Tabs`, `Chart` (SVG with a table switch and text description), `ProgressBar`, states, plus one component per screen.

## Data modes

- Default: fixtures in memory (`lib/data/admin/store.ts`). Reset on server restart.
- `ADMIN_DATA=real`: audit log (`@ad/audit`), analytics overview and per video (`@ad/analytics`) and player quality use the packages through `getServices().db`.
- Production refuses fixtures unless `ADMIN_FIXTURES=on` (D-066). Until the services below are wired, those screens show the admin error page in production.
- Sign in uses lane B real auth when enabled and fixture auth otherwise (password `fixture-password`, code `123456`; chiamaka@example.test is admin, ngozi@example.test is editor).
- Uploads use `ADMIN_UPLOADS=http` to call lane D upload endpoints. Otherwise a simulated flaky transport is used.

## Tests

- Rules and services: `pnpm vitest run apps/web/src/lib/admin apps/web/src/lib/uploader apps/web/src/lib/data/admin`
- Components: `pnpm vitest run apps/web/src/components/admin`
- Browser: `E2E_BASE_URL=http://localhost:3100 pnpm --filter @ad/web exec playwright test e2e/admin-upload.e2e.ts` (admin login, upload with a flaky file resumed by Retry on desktop and mobile, editor denied the audit log).

## Decisions

D-025, D-026, D-065 to D-069.

## Gaps

- Not wired to real services (fixture only): videos, series, categories, home curation, captions, users and viewer suspension, staff roles and invites, my account, system jobs and storage. Lane D routes need `getActor`, a rate limiter and a job producer wired in `apps/web` first. Lane B staff methods need a reauth dialog (D-069). Lane C needs home row and curation storage.
- Caption review uses a simulated player clock. Swap it for `@ad/player` preview (`POST /api/play/{id}/session` with `preview: true`) when the review screen is wired to real captions.
- Viewer preview link from the video screen goes to `/watch/:id` and is not checked for staff preview tokens.
- Invite acceptance page always shows the expired state in fixture mode. 2FA enrolment and recovery codes at sign in belong to lane B screens.
- Session expiry warning and a notifications bell are not built. A 403 is shown as an in page "no access" state, not an HTTP status.
- Notification preferences on My account are not built.
