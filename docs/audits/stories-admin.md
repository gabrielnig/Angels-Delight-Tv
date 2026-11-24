# Admin stories audit (lane a2)

Independent audit of every Must and Should story for modules M12 to M20, M27 to M30 (91 stories) against the code and tests on `main` after lane a2's slices. Could stories are not audited. Lane notes were not trusted: each row names the test files that prove it. Evidence was matched at file level, with the risky criteria (edge and error cases) checked by hand; where a criterion has no test the gap column says so.

Status rules: **done with test** means every acceptance criterion is implemented and a test proves it. **done without test** means the code exists but a criterion has no test. **partial** means a criterion is not met in code. **missing** means no implementation.

Super admin: the role exists since lane f1 (D-128), the rows reserved for it are enforced on the server and in SQL.

| Story | Priority | Status | Evidence | Gap |
|---|---|---|---|---|
| M12-S01 Admin sign in | Must | done with test | packages/auth/src/staff.int.test.ts; signin.int.test.ts; staff-recovery.int.test.ts (wrong password counts to the admin lockout, reset clears it, D-104) | Generic failure copy and 30 minute lock are proven; no browser level test of the sign in page |
| M12-S02 Two factor authentication enrolment | Must | done with test | packages/auth/src/staff.int.test.ts; totp.test.ts; seed-admin.int.test.ts; MyAccountView.test.tsx (recovery codes) |  |
| M12-S03 Reset an admin's 2FA | Should | done with test | packages/auth/src/super-admin.int.test.ts (admin and forged actor refused, self reset refused, Super admin resets with own code); staff.int.test.ts (sessions end, mail); RolesInvites.test.tsx | Super admin only since D-128 |
| M12-S04 Role based access | Must | done with test | packages/auth/src/guards.test.ts; apps/web/src/lib/admin/can tests; session.test.ts; AdminShell.test.tsx (nav by role) |  |
| M12-S05 Invite an admin user | Must | done with test | super-admin.int.test.ts (admin refused, Super admin invites any staff role); staff.int.test.ts (expiry, single use); real/people.int.test.ts | Super admin only since D-128 |
| M12-S06 Change or remove a role | Must | done with test | super-admin.int.test.ts (admin and forged role refused in the service and in SQL, self change refused, last Super admin guard on update, suspend and delete, concurrent change conflict); staff.int.test.ts (sessions end); real/people.int.test.ts | Trigger `keep_one_active_admin` guards the last Super admin (D-128) |
| M12-S07 Roles screen | Must | done with test | RolesInvites.test.tsx (Super admin column, last Super admin note, own role locked); nav.test.ts (hidden from admin); real/people.int.test.ts | Page checks `roles.view`; others get the no access screen |
| M12-S08 Admin session timeout | Must | done with test | SessionExpiryWarning.test.tsx; packages/auth/src/sessions.int.test.ts; ReauthDialog.test.tsx |  |
| M12-S09 My admin account | Should | done with test | MyAccountView.test.tsx; real/account.int.test.ts; NotificationPrefsCard.test.tsx (email choices) |  |
| M13-S01 Open the upload screen | Must | done with test | UploadLane.test.tsx; packages/video/src/upload/service.int.test.ts |  |
| M13-S02 Drag and drop feedback | Must | done with test | UploadLane.test.tsx; states.test.tsx |  |
| M13-S03 Multi-file independent queue | Must | done with test | UploadLane.test.tsx; UploaderContext usage |  |
| M13-S04 Honest progress | Must | done with test | UploadLane.test.tsx; upload/http.test.ts |  |
| M13-S05 Resumable multipart upload | Must | done with test | packages/video/src/upload/service.int.test.ts; upload/http.test.ts | Resume after a closed tab depends on the browser keeping the session; server resume is proven |
| M13-S06 Inline retry | Must | done with test | UploadLane.test.tsx |  |
| M13-S07 File validation | Must | done with test | packages/video/src/upload/validation.test.ts; service.int.test.ts |  |
| M13-S08 Upload completion preview card | Must | done without test | UploadLane.tsx completion card | No test names the preview card poster state |
| M13-S09 Create draft on upload | Must | done with test | upload/service.int.test.ts (draft with title from file name) |  |
| M13-S10 Leave the page safely | Should | done without test | UploaderContext.tsx registers beforeunload while uploads run | No test for the warning |
| M13-S11 Cancel and clean up | Should | done with test | upload/service.int.test.ts (abort, cleanupExpired); apps/worker/src/handlers.test.ts (cleanup fails loudly) |  |
| M14-S01 Queue an encoding job | Must | done with test | packages/queue/src/queue.int.test.ts; definitions.test.ts; encode/pipeline.int.test.ts |  |
| M14-S02 Probe the source | Must | done with test | packages/video/src/probe.test.ts; encode/pipeline.int.test.ts |  |
| M14-S03 Encode HLS ladder | Must | done with test | ladder.test.ts; encode/ffmpeg.test.ts; encode/ffmpeg.int.test.ts |  |
| M14-S04 Encrypt segments | Must | done with test | hls-key.test.ts; playback/service.test.ts; pipeline.int.test.ts |  |
| M14-S05 Progress and stages | Must | done with test | pipeline.int.test.ts; admin/pipeline.int.test.ts |  |
| M14-S06 Failure, retry and backoff | Must | done with test | packages/queue/src/worker.test.ts; failure.test.ts; lifecycle/failed.int.test.ts; FailedEncodes.test.tsx; handlers.test.ts (notice on final failure) |  |
| M14-S07 Resource limits on the VPS | Should | done with test | encode/scratch.test.ts; definitions.test.ts (concurrency); ffmpeg threads and nice in runtime env | Free disk guard is tested; CPU niceness is config only |
| M14-S08 Publish renditions to R2 | Must | done with test | pipeline.int.test.ts; playback/service.test.ts | R2 itself is not reachable in tests; storage adapter is local |
| M14-S09 Encoding queue screen | Must | done with test | FailedEncodes.test.tsx; admin/pipeline.int.test.ts; apps/web real/catalog.int.test.ts |  |
| M15-S01 Auto generate English captions | Must | done with test | captions/generator.int.test.ts; handlers.test.ts and notifier.int.test.ts (bell notice, D-112); `f1`: packages/queue/src/digest.int.test.ts and outbox.int.test.ts (failure and captions ready email from the choices, sent by the worker), apps/web/src/lib/data/admin/real/notices.int.test.ts (sealed address, frequency) | Immediate means within a minute (D-129) |
| M15-S02 Align an existing script | Should | done with test | captions/align.test.ts; align.fixtures.test.ts; generator.int.test.ts | Agent m3 owns script alignment tuning |
| M15-S03 Caption review list | Must | done with test | admin/captions.int.test.ts; real/captions.int.test.ts |  |
| M15-S04 Review screen layout | Must | done with test | CaptionReview.test.tsx; PreviewPlayer.test.tsx; usePreviewClock.test.tsx |  |
| M15-S05 Edit cue text and timing | Must | done with test | CaptionReview.test.tsx; caption-commands.test.ts; captions/service.int.test.ts (autosave coalescing, D-111) | Autosave policy now one working revision per editor per 10 minutes |
| M15-S06 Find and replace | Should | done with test | CaptionReview.test.tsx; caption-commands.test.ts |  |
| M15-S07 Approve a caption track | Must | done with test | captions/service.int.test.ts; real/captions.int.test.ts |  |
| M15-S08 Reject or regenerate | Should | done with test | captions/service.int.test.ts; real/captions.int.test.ts |  |
| M15-S09 Upload or download a caption file | Should | done with test | captions/service.int.test.ts (import, size cap); vtt.test.ts |  |
| M15-S10 Caption gate before publish | Must | done with test | packages/catalog/src/publishing.int.test.ts; PublishDialog.test.tsx; video-rules.test.ts |  |
| M16-S01 Videos list | Must | done with test | packages/catalog/src/admin/videos-page.int.test.ts (5050 rows, keyset cursor, filters, D-110); VideosList.test.tsx; video-queries.test.ts | Search is title and tag only. The SQL status badge must stay in step with adminStatusOf, covered by one shared case set, not a generated one |
| M16-S02 Edit video details | Must | done with test | admin/videos.int.test.ts; VideoEditor.test.tsx; video-commands.test.ts |  |
| M16-S03 Choose or upload a poster | Must | done with test | admin/posters.int.test.ts; PosterPicker.test.tsx |  |
| M16-S04 Create and edit a series | Must | done with test | admin/collections.int.test.ts; collection-commands.test.ts |  |
| M16-S05 Manage categories | Must | done with test | admin/collections.int.test.ts; CategoriesManager.test.tsx |  |
| M16-S06 Soft delete and undo | Should | done with test | admin/videos.int.test.ts (trash, restore); lifecycle/service.int.test.ts (purge) |  |
| M16-S07 Video detail status panel | Must | done with test | VideoEditor.test.tsx; admin/videos.int.test.ts |  |
| M16-S08 Preview as viewer | Should | done with test | PreviewPlayer.test.tsx; usePreviewClock.test.tsx |  |
| M16-S09 Bulk edit | Should | done with test | video-queries.test.ts (applyBulk); admin/videos.int.test.ts (bulkAdminVideos); VideosList.test.tsx |  |
| M16-S11 Admin dashboard | Must | done with test | dashboard.test.ts; real/catalog.int.test.ts |  |
| M17-S01 Choose hero titles | Must | done with test | admin/home.int.test.ts; HomeCuration.test.tsx; home-rules.test.ts |  |
| M17-S02 Create and order rows | Must | done with test | admin/home.int.test.ts (series rows follow the series, D-105); HomeCuration.test.tsx |  |
| M17-S03 Manage titles in a manual row | Must | done with test | admin/home.int.test.ts; HomeCuration.test.tsx |  |
| M17-S04 Live preview | Should | done with test | HomeCuration.test.tsx; home-rules.test.ts |  |
| M17-S05 Personal row positions | Should | done with test | HomeCuration.test.tsx (move My List); admin/home.int.test.ts (fixed rows kept, hidden when empty); packages/viewer/src/home.int.test.ts |  |
| M17-S07 Publish curation changes | Should | done with test | admin/home.int.test.ts (draft, publish, restore earlier version) |  |
| M28-S01 Publish now | Must | done with test | packages/catalog/src/publishing.int.test.ts; PublishDialog.test.tsx |  |
| M28-S02 Schedule publication | Must | done with test | publishing.int.test.ts; apps/worker/src/maintenance.int.test.ts |  |
| M28-S03 Unpublish and republish | Must | done with test | publishing.int.test.ts |  |
| M28-S04 Cancel or change a schedule | Should | done with test | publishing.int.test.ts; PublishDialog.test.tsx |  |
| M28-S05 Publish checklist gate | Must | done with test | publishing.int.test.ts; video-rules.test.ts; PublishDialog.test.tsx |  |
| M28-S06 Series visibility rule | Should | done with test | packages/catalog/src/visibility.int.test.ts; titles.int.test.ts |  |
| M18-S01 Edit colours | Must | done with test | ThemeEditor.test.tsx; packages/theme/src/service.test.ts; derive.test.ts |  |
| M18-S02 Contrast warning | Must | done with test | contrast.test.ts; gate.test.ts; ThemeEditor.test.tsx |  |
| M18-S03 Fonts from a curated list | Must | done with test | model.test.ts; ThemeEditor.test.tsx; css.test.ts |  |
| M18-S04 Sizes | Should | done with test | model.test.ts; css.test.ts |  |
| M18-S05 Logo and platform name | Must | done with test | logo.test.ts; settings-service.test.ts; SiteSettingsView.test.tsx | Brand placeholders belong to agent m3 |
| M18-S06 Live preview | Must | done with test | ThemeEditor.test.tsx; inject.test.ts |  |
| M18-S07 Save, publish and reset | Must | done with test | service.test.ts; drizzle-store.int.test.ts; PresetPicker.test.tsx | Preset content belongs to agent m3 |
| M18-S08 Theme history | Should | done with test | ThemeHistoryView.test.tsx; drizzle-store.int.test.ts |  |
| M18-S09 Safe theming rules | Must | done with test | token-pairs.test.ts; gate.test.ts; html-sanitize.test.ts |  |
| M19-S01 Record play events | Must | done with test | packages/analytics/src/ingest.test.ts; events.test.ts; client/play-tracker.test.ts; client/batcher.test.ts; analytics.int.test.ts |  |
| M19-S02 Overview dashboard | Must | done with test | AnalyticsView.test.tsx; queries.test.ts; analytics.int.test.ts |  |
| M19-S03 Top titles and per video analytics | Must | done with test | analytics.int.test.ts; AnalyticsView.test.tsx; histogram.test.ts |  |
| M19-S04 Audience splits | Should | done with test | analytics.int.test.ts; AnalyticsView.test.tsx |  |
| M19-S05 CSV export | Should | done with test | analytics-export.test.ts; analytics.int.test.ts (titleDaily); export route test (D-103); apps/worker/src/exports.int.test.ts; real/exports.int.test.ts (D-130) | Over 10,000 rows the export is a background job with an emailed download link |
| M19-S06 Daily rollups | Must | done with test | analytics.int.test.ts; apps/worker/src/maintenance.int.test.ts; prunes.int.test.ts (raw retention from settings) |  |
| M19-S07 Privacy of analytics | Must | done with test | identity.test.ts; ingest.test.ts; rate-limit.test.ts |  |
| M20-S01 Record audit entries | Must | done with test | packages/audit/src/audit-writer.int.test.ts; redact.test.ts; entry.test.ts (one writer, one redaction policy, D-090) |  |
| M20-S02 Browse the audit log | Must | done with test | query.test.ts (security, staff, role and job prefixes); audit.int.test.ts; AuditLogView.test.tsx (restricted note); audit-adapter.test.ts (scope by role) | Admin sees content actions only, Super admin sees all (D-128) |
| M20-S03 Export audit log | Should | done with test | csv.test.ts; audit-adapter.test.ts; packages/audit/src/stream.int.test.ts; apps/worker/src/exports.int.test.ts (D-130) | Background job with an emailed link, capped only by the 2,000,000 row ceiling |
| M20-S04 Retention | Should | done with test | retention.test.ts; apps/worker/src/prunes.int.test.ts; settings-read.int.test.ts (audit.retention_months, D-091) |  |
| M27-S01 Search viewer accounts | Should | done with test | real/people.int.test.ts; users-commands.test.ts |  |
| M27-S02 View an account | Should | done with test | real/people.int.test.ts; account.int.test.ts |  |
| M27-S03 Support actions | Should | done with test | staff.int.test.ts; users-commands.test.ts; super-admin.int.test.ts (delete account: admin, editor and forged role refused, SQL refuses, typed word, audit, mail); real/people.int.test.ts; RolesInvites.test.tsx (Delete account dialog) | Delete is Super admin only. Password reset on behalf is not built as an admin action, the owner uses the reset link |
| M29-S01 Platform details | Must | done with test | settings-service.test.ts; SiteSettingsView.test.tsx; real-site.test.ts |  |
| M29-S02 Feature flags and limits | Must | done with test | settings-registry.test.ts; settings-service.test.ts (Super admin default, 60 second cache); site-settings.test.ts (admin refused, Super admin saves); SiteSettingsView.test.tsx; settings-read.int.test.ts | Super tier keys need `super_admin` (D-128) |
| M29-S03 Invite only sign up | Should | done with test | packages/auth/src/signup-invites.int.test.ts; real/invite-codes.int.test.ts; InviteCodesTab.test.tsx; SignUpForm tests (D-099) |  |
| M30-S01 Reliable jobs | Must | done with test | packages/queue/src/queue.int.test.ts; worker.test.ts |  |
| M30-S02 Scheduled jobs | Must | done with test | apps/worker/src/maintenance.int.test.ts; handlers.test.ts (crons) |  |
| M30-S03 Dead jobs screen | Should | done with test | SystemView.test.tsx (Jobs tab hidden from admin); real/system.int.test.ts (admin refused jobs, retry and discard) | Super admin only (D-128) |
| M30-S04 Job concurrency control | Should | done with test | packages/queue/src/definitions.test.ts; queue.int.test.ts |  |

## Counts by status

- done with test: 89
- done without test: 2
- partial: 0
- missing: 0
- Total: 91

## Gaps fixed by lane f1 (slice 1)

- Super admin role (D-128): M12-S03, M12-S05, M12-S06, M12-S07, M20-S02, M27-S03, M29-S02, M30-S03 and the last Super admin guard.

## Gaps fixed by lane f1 (slice 3)

- Notification email from the saved choices, hourly and daily summaries, and the email outbox with retry and provider message ids (D-129, M15-S01 AC2, M21-S03).

## Gaps fixed by lane a2

- Audit writers merged into `@ad/audit` with one redaction policy (D-090). Audit and raw analytics retention read from settings (D-091, M20-S04, M19-S06).
- Invite codes for viewer sign up (D-099, M29-S03). Analytics export rows (D-103, M19-S05). Staff password and recovery lockout flows (D-104, M12-S01).
- Home series rows follow the series (D-105, M17-S02). Video list pages in the database past 5000 rows (D-110, M16-S01).
- Caption autosave coalescing (D-111, M15-S05). Staff notices, bell and email choices (D-112, D-113, M15-S01 AC2 in app).

## Open gaps

- No tamper evident audit chain (M20-S05, a Could).

Lane L3 additions (M42, Must and Should only; browser checks recorded in docs/lanes/L3-build.md):

| Story | Priority | Status | Evidence | Gap |
|---|---|---|---|---|
| M42-S01 One table alignment rule | Should | done with test | tables.test.ts; admin-css.test.ts | |
| M42-S08 Bulk approve captions | Should | done with test | caption-commands.test.ts; CaptionTable.test.tsx | |
| M42-S09 Bulk retry encodes | Should | done with test | EncodingBulk.test.tsx; video-commands tests | |
| M42-S13 Bulk Trash restore and delete forever | Should | done with test | TrashList.test.tsx; video-bulk.test.ts | |
| M42-S12 Series bulk | Should | done with test | SeriesList.test.tsx; series-bulk.test.ts | |
| M42-S10 Viewer account bulk | Should | done with test | UsersTableClient tests; user-bulk.test.ts | |
| M42-S11 Staff role bulk | Should | done with test | RolesInvites.test.tsx; staff-bulk.test.ts | |
| M42-S14 Upload shared details | Should | done with test | upload-details.test.ts; UploadScreen.test.tsx | |
| M42-S15 Per file overrides | Should | done with test | UploadOverrides.test.tsx; UploadScreen.test.tsx | |
| M42-S16 Publish later on upload | Could | not built | | Not audited, Could |
