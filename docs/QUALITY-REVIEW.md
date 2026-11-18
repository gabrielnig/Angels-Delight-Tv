# Quality and AI footprint review

Lane J2. Scope: all of main at commit 2412c7e plus the lane K2 and K3 merges that landed during the review. Checklist: `docs/AI-CODE-FOOTPRINT.md`. Tools: `scripts/footprint-check.sh`, ripgrep style sweeps, `knip` 5 (run from a temp directory, not added to the repo), typecheck and scoped tests.

## 1. Summary

The tree is in good shape. The mechanical footprint rules hold in every file. The findings are a few swallowed errors, dead code, stale docs and three items that need a decision from the main session.

| Area | Result |
|---|---|
| Em dashes, en dashes, smart quotes, emojis in tracked files | None (code, docs, UI copy, tests, SQL, CSS) |
| AI attribution strings in tracked files | None. Only the rule text in CLAUDE.md and a reference to the Anthropic harness in SECURITY.md |
| Commit messages | Specific, one line. One commit has attribution trailers (section 2) |
| TODO, FIXME, HACK left behind | None |
| Console output in app code | None (two CLI seed scripts print to the terminal, which is correct) |
| `@ts-ignore`, `any` | None. A handful of `eslint-disable` lines, all on `<img>` for data URLs or a control character regex |
| Restating comments, generic names, generic test names | None worth changing. `result` and `data` appear only where the domain meaning is clear from the surrounding line |
| Docs against code | Several stale items, fixed here (section 5) |

## 2. Needs the main session (history and policy)

These touch git history or project policy, so they were not changed here.

1. Commit `1149482` ("Add named rate limit buckets and publishing with scheduling for the catalog") carries an AI co-author trailer and a session link trailer. This breaks the no attribution rule. `scripts/footprint-check.sh --range` reports it. Fixing it needs a history rewrite.
2. Commits `ffe73d8` (#24) and `457847d` (#22) have the author `gabrielnig` and committer `GitHub` (merged through the web UI, not the rebase API). Two other commit messages carry a co-author line naming ARKDEV, which is redundant next to an ARKDEV author. They need the same history pass.
3. Every rebase merged commit has committer `gabrielnig`, because the GitHub merge API rewrites the committer to the token owner. `footprint-check.sh --range` therefore always fails on the committer rule. Either accept the committer for merges and check only the author in the script (with a test), or give the merging token the ARKDEV identity.
4. Two audit writers exist: `AuditWriter` in `@ad/security` (lane B, best effort, drops metadata keys by regex) and `writeAudit`, `withAudit`, `recordAudit` in `@ad/audit` (lane I, transactional, `redact`). They write the same table with different redaction rules. Lane H already noted it. Recommendation: make `@ad/auth` and the web auth runtime use `recordAudit` from `@ad/audit`, delete `packages/security/src/audit.ts`, and keep one redaction path. It changes what auth events store, so it needs its own tests and a decision entry. Resolved by D-090.

## 3. Fixed in this lane

| Finding | Fix | PR |
|---|---|---|
| `realInspectInvite` caught every error and returned null, so a database outage showed "This invite has expired" | Returns null only for `TokenRejected`, rethrows the rest. Test file `apps/web/src/server/auth/admin-invite.test.ts` | invite-errors |
| Dead exports with no caller: `loadMyListAction`, `setPwaSettingsSource`, `setDataForTests`, `requireSession`, the `lib/lowdata/index.ts` barrel | Removed | dead-code |
| Unused dependencies: `pg` and `@types/pg` in `apps/worker`, `@axe-core/playwright` in `apps/web`, `@ad/shared` in `packages/config` | Removed, lockfile refreshed | dead-code |
| DECISIONS.md had two entries numbered D-079 (lane K2 and lane K3) | The caption review entry is now D-083 | docs |
| Stale docs (section 5) | Updated | docs |

## 4. Open findings

### 4.1 Silent failure

Grouped by risk. "Intentional" means the swallow is a documented best effort path and only lacks a log line.

| Where | What happens | Risk | Recommendation |
|---|---|---|---|
| `apps/web/src/app/admin/(shell)/system/page.tsx` catch | Any error becomes "We could not load the system screen" with no log | Medium | Log the error with `createLogger` before rendering the state. Same for `analytics/[id]/page.tsx` (non NotFound errors) |
| `packages/auth/src/accounts.ts:375` `.catch(() => null)` on the resend verification lookup, then returns `{ sent: true }` | A database or decrypt failure looks like a sent email. The always `sent: true` reply is deliberate (no enumeration), the swallowed failure is not logged | Medium | Log at warn level, keep the response |
| `packages/auth/src/accounts.ts:183` and `seed-admin.ts:63`, `staff.ts:683` `keys.destroy(...).catch(() => undefined)` in sign up and seed failure paths | A failed cleanup leaves an orphan wrapped key for a non existent account | Low | Log at warn level so orphans can be found |
| `packages/auth/src/accounts.ts:887, 966` `mailer.sendAlreadyRegistered(...).catch(() => undefined)` | Intentional for no enumeration, no log | Low | Log at warn level |
| `packages/video/src/upload/service.ts:396, 434` `originals.delete(...)` and `deletePrefix(...)` swallowed (the sibling calls at 385 to 440 already log) | An orphaned original or template prefix leaves no trace | Low | Log with `this.logger.warn` like the neighbouring lines. Needs an integration test for the delete failure path |
| `apps/web/src/server/viewer/analytics-identity.ts` and `lib/analytics/handler.ts` catch around viewer resolution | Falls back to anonymous. Fail safe for kids (no identity stored), documented as "always quiet" | Intentional | Add a debug log so a broken resolver is visible |
| `apps/web/src/lib/pwa/sw-source.ts:83` `cache.add(url).catch(function () {})` | One failed precache URL does not fail the service worker install | Intentional | Add a one line comment saying why |
| `apps/web/src/app/(viewer)/search/page.tsx:21` `.popular(ctx).catch(() => [])` | A catalog error shows the empty search state | Low | Log, or let the error boundary show |
| `apps/web/src/app/admin/(shell)/audit-log/page.tsx:29` `auditService.get(...).catch(() => null)` | A broken lookup looks like "no entry selected" | Low | Narrow to `NotFound` |
| `packages/analytics/src/ingest.ts:100`, `batcher.ts:70`, `error-reporter.ts:92` | Telemetry never breaks the app | Intentional | None |
| Client `catch {}` blocks that restore state and show a toast (My List, admin lists, caption review) | The user is told, the error object is dropped | Intentional | None |

### 4.2 Dead and duplicated code

`knip` also lists about 70 exported types and 30 exported constants used only inside their own file (props types, `*_MAX`, fixture reset helpers). They are harmless. Not changed, because removing an `export` keyword in bulk is churn without value. Two real leftovers worth a look: `createUnsupportedEngine` (exported, used only inside `hlsEngine.ts`) and `xhrPutPart` (same, in `http-transport.ts`).

Duplicates between lanes, none of which are bugs but all of which will drift:

| Duplicate | Where | Note |
|---|---|---|
| `formatDuration` with two meanings | `packages/ui` ("4 min") and `apps/web/src/lib/admin/format.ts` (`m:ss`) | Rename the admin one to `formatClock` style, or document |
| `formatDate` with two meanings | `apps/web/src/lib/format.ts` (UTC "17 Nov 2026") and `lib/admin/format.ts` (Lagos, no year) | Pick one rule for viewers and one for staff, name them differently |
| `NO_STORE` header constant defined four times | `server/viewer/http.ts`, `server/data/export-route.ts`, `lib/analytics/handler.ts`, `packages/video/src/http/respond.ts` (the last uses a different value, `no-store` without `private`) | Share one constant for the web app |
| Two audit writers | Section 2, item 4 | Decision needed |

### 4.3 Unused dependency check, reviewed and kept

`tsx` at the root looks unused to `knip` but is the runner for the `seed:admin`, `seed:demo`, `db:migrate` and worker scripts in other packages. `wrangler` in `apps/edge` and the Python tooling in `apps/whisper` are real. `scripts/generate-pwa-icons.mjs` is a manual tool, referenced in the lane I notes.

### 4.4 Over-validation and speculative abstractions

None found. The `if (!row) throw` guards after inserts and lookups sit at real boundaries (an insert that returned no row, a token that is absent). The admin service interfaces in `lib/data/admin/services.ts` have a fixture and a real implementation, so they are not single implementation abstractions.

### 4.5 Commit history

Messages are specific and name the change. The split reflects real slices. See section 2 for the author, committer and trailer problems.

## 5. Docs against code

| Doc | Problem | State |
|---|---|---|
| `ai-context.md` | Described only lane A, listed built things as "not yet built" | Rewritten for the current state of all lanes |
| `docs/DEV-SETUP.md` | Said `db:seed:admin` was not implemented, said the admin upload screen arrives with lane F, status line named lane A | Fixed. Added the seed commands and the data mode flags. Every command in section 5 maps to an existing script (`db:generate`, `db:migrate`, `db:studio`, `test:file`, `hooks:install`, `footprint`) |
| `docs/DATA-MODEL.md` | No mention of `admin_invites`, `auth_lockouts`, `verification_codes`, `analytics_counters`, `site_daily_stats` (only in a lane H note), `search_history`, `slug_redirects`, the new columns or the SECURITY DEFINER functions from migrations 0006 to 0016 | Added section 12 listing each migration |
| `docs/ARCHITECTURE.md` | Monorepo layout showed whisper, edge, queue, crypto and video as "not yet created" and omitted nine packages. Auth recommended `packages/crypto`. Player row said "confirm v10 is stable" | Layout, auth path and player row updated. `compose.prod.yaml` is still absent, and the layout does not claim it exists |
| `docs/TESTING.md` | Coverage table and examples pointed at `packages/crypto`, which does not exist | Now point at `packages/shared/src/crypto.ts` and `packages/auth/src/keys.ts` |
| `docs/BUILD-PLAN.md` | Lane G row said Video.js v10 | Says hls.js behind our own interface (D-042) |
| `docs/DECISIONS.md` | Duplicate D-079 | Renumbered to D-083 |
| `CHANGELOG.md` | Lane sections used mixed heading levels outside Unreleased | One heading level per lane, J2 entry added |
| `.env.example` against `DEV-SETUP.md` | 20 variables in `.env.example` are not named in DEV-SETUP | Accepted. DEV-SETUP says `.env.example` is the full list and a test keeps it complete |
| `docs/lanes/*.md` gaps lists | Several gaps were closed by the K lanes (lane B invites and roles page, lane E fixtures, lane F wiring) but the lane notes still list them | Left as written. They are dated lane reports. The current picture is in `ai-context.md` |

## 6. How to repeat the sweep

```bash
scripts/footprint-check.sh --range <first-commit>..HEAD
git ls-files -z | xargs -0 grep -InP '[\x{2013}\x{2014}\x{2018}\x{2019}\x{201C}\x{201D}\x{2600}-\x{27BF}\x{1F000}-\x{1FAFF}]'
grep -rnE 'catch\s*(\([^)]*\))?\s*\{' apps packages --include=*.ts --include=*.tsx -A2
npx knip@5 --no-progress --reporter compact
```
