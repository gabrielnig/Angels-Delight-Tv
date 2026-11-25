# L14 content lane C7: Troubleshooting, Reference and Handover (module M50)

Worktree `/home/claude/wt2/C7-content`, demo stack on port 3207, raw outputs in `/home/claude/kb-out/C7` (never committed). Decision D-388.

## What this lane owns

| Path | Ids | Notes |
|---|---|---|
| Troubleshooting (`troubleshooting/`) | T01 to T17 | T01 to T11 are the plan inventory, T12 to T17 are new symptoms from the code |
| Reference (`reference/`) | R01 to R03, R05 to R13 | R04 (settings dictionary) is not in this lane |
| Handover | R07, R10 to R13 | Reference path by D-388 |
| Glossary | `content/help/en/glossary.md` | 55 terms, A to Z |

## Generated guides (cannot drift)

`apps/web/src/lib/admin/help-reference.ts` writes the lists of R02 (permission table), R03 (screens and deep links), R05 (keys) and R06 (statuses and badges) between `kb:generated` markers. `pnpm vitest run apps/web/src/lib/admin/help-reference.test.ts` fails when an article is out of date, or when the code gains an action, screen or status with no plain words. Rewrite with `KB_WRITE_REFERENCE=1`.

## Demo states added for troubleshooting

`apps/web/src/lib/data/admin/kb-demo/trouble.ts` (tested in `trouble.test.ts`): `vid_test_clip` has failed captions, `vid_decimals` has a failed preview clip, `vid_hygiene` a skipped one, and the series "Demo series: Small space gardening" has one published and one draft lesson. The failed encode (`vid_solar`) and the failed jobs on System (encode, captions, email) come from the base fixture.

## Batches

| Batch | Articles | PR | State |
|---|---|---|---|
| 1 | R01, R02, R03, R05, R06, glossary | | in progress |

## Differences between the plan and the real screens

- System has three tabs: Jobs (Super admin only), Storage and Player quality. It has no backup, uptime or email status and no Cloudflare plan figure. The guides say so and point to the right places.
- The Publish button is only greyed while the video is still preparing, failed, or has unsaved changes. Other blockers show as red items in "Before you publish" (6 items).
- Staff two step reset is in Roles and invites (Super admin, needs the Super admin's own code). An Admin resets a viewer from Users.
- The plan says a locked account waits 30 minutes. The screen shows the number of minutes, so the guides say "the minutes shown".

## Could not be shown in fixture mode

- The recovery code box on the staff code page (the link appears only with real sign in), the lockout message, and the real two step reset.
- Real encoding progress, real upload failures, real playback errors with a reference code, a backup status, the uptime monitor and the Cloudflare dashboard. These are written from the code and `docs/DEPLOYMENT.md`.

## Left to do

See the batch table. Cross links to articles owned by other lanes (D, W, C, M, K, S ids) are added in the final pass once those lanes have merged, because `help:check` refuses a link to a missing guide.

## Scoped checks

`pnpm help:check`, `pnpm vitest run packages/help/src/node.test.ts apps/web/src/lib/admin/help-reference.test.ts apps/web/src/lib/data/admin/kb-demo apps/web/src/lib/admin/kb-episode-coverage.test.ts apps/web/src/lib/admin/help-coverage.test.ts scripts/kb-recorder/episodes.test.ts`, `scripts/footprint-check.sh`.
