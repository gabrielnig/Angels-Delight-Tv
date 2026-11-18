# Lane F1: final admin and ops gaps

Branches `lane-f1/*`. One pull request per slice, rebase merged through the REST API.

## What was built

| Slice | PR | Story | Summary |
|---|---|---|---|
| Super admin role | 142 | M12-S03, S05, S06, M20-S02, M27-S03, M29-S02, M30-S03 | Additive migration, staff service, `can()` matrix, seeds, server side guards and adversarial tests (D-128) |
| Email outbox and summaries | 146 | M15-S01, M21-S03 | `email_outbox` with retry, backoff, provider message ids, batching and hourly and daily summaries. Auth mail stays direct (D-129) |
| Fixes found on main | 148 | none | `.env.production.example`, theme settings store integration tests, `posters.int.test.ts` type error |
| Background exports | 151 | M19-S05, M20-S03 | Over 10,000 rows an export is a job and the requester gets an emailed link (D-130) |
| Storage estimate | 152 | M22-S03 | Monthly estimate and 80 percent warning on System (D-131) |
| Backup manifest and retention | 153 | M32-S01 | Manifest with size and SHA-256, 14 daily plus 8 weekly (D-132) |
| DNS and email auth check | 155 | M21-S04 | `pnpm dns:check` with injected resolvers (D-133) |
| Poster scoring and variants | 157 | M36-S01, M36-S02 | Six scored frames, AVIF, stored blur (D-134) |

## Exported APIs and routes

- Exports: table `staff_exports` (migration 0033, RLS owner only for `ad_app`). Queues `exports.generate` and `exports.cleanup` (daily 03:45 Lagos). Worker `generateExport` and `cleanupExports`. Web routes `/admin/exports` (list), `/admin/exports/new` (confirm, no side effect), `/admin/exports/[id]/download` (stream, private, no store). The existing audit and analytics export routes answer 303 to the confirm page over 10,000 rows. Ceiling 2,000,000 rows because the S3 `put` buffers the stream.
- Outbox: `enqueueEmail`, `drainOutbox`, `pruneOutbox`, `openStaffAddress` in `@ad/queue`. Queues `email.outbox` (every minute) and `email.digest` (5 past the hour).
- Storage budget: `systemService.storageBudget(actor)`, rules `storageBudget` and `STORAGE_WARN_PERCENT` in `system-rules.ts`. Budget is the `limits.storage_cap_bytes` setting.
- Backups: `selectExpiredGfs`, `buildManifest`, `manifestKey`, `parseManifest`, `fileSha256` in `packages/launch/src/backup`. Env `BACKUP_KEEP_DAILY` (14) and `BACKUP_KEEP_WEEKLY` (8) replace `BACKUP_RETAIN_DB_DAYS` and `BACKUP_RETAIN_KEYS_DAYS`. The keys database keeps 14 daily and no weekly (SECURITY section 10).
- DNS check: `runDnsCheck(config, resolver)`, `nodeResolver`, `domainOfAddress` in `packages/launch/src/dns`. Command `pnpm dns:check`.
- Images: `processImage` now returns AVIF variants and `placeholderBlur`. `scoreFrame` in `packages/video/src/image/score.ts`. `LOW_FRAME_SCORE` and `allFramesLow` in `@ad/shared`. Migration 0034 adds `assets.placeholder_blur` and `assets.candidate_score`. `ArtworkDto.placeholderBlur`, `PosterAssetDto.score`, `PosterSources.avif`.

## Scoped tests

```bash
export TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres
pnpm vitest run packages/db/src/exports.int.test.ts packages/db/src/assets-artwork.int.test.ts
pnpm vitest run packages/queue/src packages/audit/src apps/worker/src/exports.int.test.ts
pnpm vitest run apps/web/src/lib/data/admin/real/exports.int.test.ts "apps/web/src/app/admin/(shell)/exports"
pnpm vitest run apps/web/src/lib/data/admin/system-rules.test.ts apps/web/src/lib/data/admin/real/system.int.test.ts apps/web/src/components/admin/SystemView.test.tsx
pnpm vitest run packages/launch/src/backup packages/launch/src/dns
pnpm vitest run packages/video/src/image packages/video/src/encode/pipeline.int.test.ts
pnpm vitest run apps/web/src/components/admin/PosterPicker.test.tsx apps/web/src/lib/media apps/web/src/components/media
```

## Gaps and notes

- M33-S01: no image build and push workflow in CI and no release version in the admin footer. Both need registry access and a staging environment from the owner.
- M24-S02 and M33-S03: disk, error rate and certificate expiry alerts are monitor settings (DEPLOYMENT section 9), not code.
- M32-S02: the quarterly restore drill record is a process step.
- M36-S03: the saved focus does not recut the generated files.
- The viewer draws the colour placeholder; cards do not use the stored blur yet.
- Exports in fixture data mode list nothing and refuse requests, so they need `ADMIN_DATA=real`.

## Facts worth keeping

- The worker role had no grants on `admin_notices` before this lane; it does now.
- `gh pr create` and GraphQL are blocked. Use `gh api repos/<owner>/<repo>/pulls` and `PUT .../merge` with `merge_method=rebase`.
- Rebase merges conflict in `docs/DECISIONS.md` and `services.ts` when lanes append at once. Keep both sides.
