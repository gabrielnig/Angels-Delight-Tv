# Lane I: low data, PWA, observability, analytics collection

Modules: M25 PWA and low data, M24 Observability, M19 Analytics (collection side), M20 Audit log. Decisions D-035, D-036, D-039, D-040, D-041.

## Packages

### @ad/analytics (`packages/analytics`)
- Event schema (`events.ts`): `view_start`, `progress`, `complete`, `search`, `error`, `vitals`, `startup`. Strict objects, so unknown keys (possible personal data) are rejected. `parseBatch` fails a bad envelope and drops bad events. Limits: 50 events and 16 KB per batch.
- Identity (`identity.ts`): `deriveAnalyticsSecret(MEDIA_URL_SECRET)`, `viewerHash(secret, lagosDay, profileId)` (daily rotating), `isBot`, `classifyDevice`.
- Client (`@ad/analytics/client`, no zod, no node imports): `createAnalyticsClient` (batching, coalesces progress, sendBeacon on page hide with keepalive fetch fallback, never throws, queue cap), `createPlayTracker` (view after 3 s of real playback, progress every 10 s, seek jumps excluded, completion once, startup and rebuffer, highest rung). The player lane feeds it `onTimeUpdate(positionMs, playing)`, `onPause`, `onEnded`, `onHide`, `setHeight`, `onStartup`.
- Server: `ingestBatch` (rate limit through any `@ad/security` style limiter, bots and previews dropped, kids store no profile or hash, counters for device, connection, country, errors, empty searches, startup and vitals buckets), `createPgEventStore` (upsert by `play_id`, same video only, never lowers watch time, unknown videos ignored).
- Rollups (`rollup.ts`): `rollupDay`, `runNightlyRollup` (yesterday and the day before), `backfillRollups`, `pruneViewEvents` (run as `ad_maintenance`), `ROLLUP_SCHEDULE` and `RETENTION_SCHEDULE` constants (Africa/Lagos).
- Queries (`queries.ts`): `createAnalyticsQueries(db, { now, cacheTtlMs })` with `overview` (previous period comparison), `topTitles`, `videoDetail` (daily views and retention curve), `audienceSplits` (groups under 10 become Other), `emptySearches`, `playerQuality` (startup p50 and p75, rebuffer ratio, errors by code, vitals p75, device and Save-Data filter). Past days read rollups, today reads raw rows live.
- Migration 0008: `view_events.viewer_hash`, `device_class`, `save_data`, tables `site_daily_stats` and `analytics_counters`.

### @ad/audit (`packages/audit`)
- `buildAuditRow` (namespaced action, redaction, changed fields only, truncated IP, 8 KB cap), `writeAudit` (throws), `withAudit(db, work, entryFor)` (action and entry in one transaction), `recordAudit` (best effort), `listAudit` (filters, keyset cursor, `scope: 'content'` hides security namespaces), `getAuditEntry`, `countAudit`, `auditCsv` (formula safe), `pruneAudit(maintenanceDb, writerDb, { retentionMonths, legalHold })`, `AUDIT_RETENTION_SCHEDULE`.

## apps/web
- PWA: `app/manifest.ts` (from `lib/data/pwa-settings.ts`), `app/sw.js/route.ts` (worker text from `lib/pwa/sw-source.ts`), `app/offline/page.tsx` (S34), icons in `public/icons` (placeholders, regenerate with `node scripts/generate-pwa-icons.mjs`), `components/pwa/*` (install banner and iOS sheet S37, connection banner and toast, `PwaClient` mounted in the root layout), `lib/pwa/*` (install rules, registration, offline write queue).
- Low data helpers others import: `@/lib/lowdata` (`readConnection`, `classifyConnection`, `prefersDataSaverByDefault`, `requestWantsSaveData`, `dataSaverPolicy`, `estimateMbPerMinute`, `subscribeConnection`, preference helpers) and `@/lib/lowdata/useDataSaver` (client hook, per profile). `components/media/ResponsivePoster` with `lib/media/poster.ts`.
- Observability: `lib/observability/*` (`withRequest`, request ids, error reporter, readiness), `lib/runtime/services.ts` (lazy config, pool, media storage, logger, reporter), `app/api/ready`, `app/api/analytics`, `components/observability/WebVitals`, `app/error.tsx` (shows the Reference).
- Config added: `PWA_ENABLED` (kill switch), `APP_VERSION` (cache name, logs, error release).

## Scoped tests
```
pnpm vitest run packages/analytics packages/audit
pnpm vitest run apps/web/src/lib/pwa apps/web/src/lib/lowdata apps/web/src/lib/media apps/web/src/lib/observability apps/web/src/lib/analytics apps/web/src/components/pwa apps/web/src/components/media apps/web/src/app/api/ready apps/web/src/app/error
```
Integration tests need `TEST_DATABASE_ADMIN_URL` (see DEV-SETUP).

## Gaps and integration notes
- Viewer identity: `lib/data/analytics-viewer.ts` defaults to anonymous. The auth lane must call `setViewerResolver` with a session lookup returning `{ profileId, audience }`. Until then events carry no profile.
- Worker jobs not registered: the worker lane should add queues for `runNightlyRollup` (`ROLLUP_SCHEDULE`), `pruneViewEvents` and `pruneAudit` (`RETENTION_SCHEDULE`, `AUDIT_RETENTION_SCHEDULE`). The two prunes need an `ad_maintenance` connection that has no env variable yet.
- No admin routes or screens for analytics or the audit log: the admin lane should call the query services. Admin previews must set `preview: true` on the analytics client.
- `/healthz` and `/readyz` aliases from M24-S02 are not added (they would need `next.config` rewrites or the proxy). `/api/health` and `/api/ready` exist.
- Request id and security headers belong in the interceptor (M23). `withRequest` covers route handlers only.
- Lighthouse budget in CI (M25-S02 AC3) is not added. Alerts (M24-S02 AC2, AC3) are operations work.
- Posters are cached by the worker only when the image response is CORS readable, so set `crossOrigin` on the poster `img` only after the media origin sends CORS headers. Otherwise posters still load, just not from the service worker cache.
- Data saver is stored in local storage per profile. Server side persistence waits for the profile service (`onChange` hook). The player must read `dataSaverPolicy` for the 360p cap and no prefetch.
- "Recently opened" on the offline screen (S34 state 1) is not built, see D-039.
- Tamper evidence for the audit log (M20-S05, Could) and the audit CSV background job are not built. `countAudit` tells the screen when a job is needed (over 10,000 rows).
