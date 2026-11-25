# Release candidate (v2)

State of `main` on 2026-11-24 at the end of the v2 programme (modules M40 to M49, lanes L1 to L10). Read this first when deciding whether to cut a release. Every fact below comes from the repository (lane notes, settings registry, env schema, migrations folder, DEPLOYMENT and LAUNCH-RUNBOOK) or from the GitHub pull request list. Nothing here has been run on a real server.

## 1. What is in v2, per lane

PR numbers come from the GitHub list of merged pull requests (the branch prefix gives the lane) and the lane notes. Rebase merges drop the number from commit subjects, so `git log` on `main` does not show them. Ranges are the lowest and highest PR of the lane, other lanes' PRs sit in between. Details and exported APIs: `docs/lanes/<lane>-build.md`.

| Lane | Module | PRs | What it built |
|---|---|---|---|
| L1 | M40 Guest access | 221 to 269 | Watch, browse and search without an account. Guest cookie and playback token, device progress, Kids mode on the device, public catalog GETs, Sign in to save, history import, Turnstile escalation, per network limits, robots |
| L2 | M41 Home hero, rows and sections | 281 to 376 | Hero carousel with optional muted preview clip, rows with View all, `/browse` list pages, hover card, admin sections editor and hero slots, launch default sections, preview clip worker job |
| L3 | M42 Admin polish and bulk operations | 215 to 271 | Shared bulk core with report and undo, bulk actions on videos, captions, encoding, Trash, series, viewer accounts, staff and invites, shared upload details, Breadcrumbs, table fixes, ink tokens, per video captions switch |
| L4 | M43 Player features | 218 to 278 | Skip intro, recap and credits, chapters and the admin marker editor, theatre mode, Up next and Still watching, caption appearance, Settings menu, low data hints and error references, AirPlay and PiP behind a flag |
| L5 | M44 Engagement | 287 to 368 | Graded maturity, likes and ratings, trending, Top 10 and Most liked rows, viewer notices with bell and page, opt in email digest, My List filter and sort, export and purge of the new data |
| L6 | M45 Discovery, SEO, consent, search | 283 to 354 | Sitemap, robots, JSON-LD, share images and menu, Discovery tab, search synonyms and corrections and misses report, storage notice and inventory, error pages, voice search, analytics posture guard, performance budget, canonical and hreflang helpers |
| L7 | M46 Languages | 280 to 385 | Locale registry and catalogs, `@ad/i18n`, admin Languages screens, import and export, caption translation job and adapter, spoken language detection and multilingual Whisper, mail and offline page by language, sample drafts for yo, ig, ha, client copy moved to catalogs (waves A to D) |
| L8 | M47 Design system tuning and guards | 217, 249 to 260 | Guard tests (hover, focus ring, touch target, reduced motion, rows, nav, hero, skeleton, tab bar, buttons, copy rules), new tokens, vietnamese font subsets and coverage manifest |
| L9 | M48 Sponsors and donations | 282 to 377 | Sponsor admin, placements, tracking and report, `@ad/payments` with the Paystack adapter, donations backbone, donate pages and receipts, admin donations, transparency page, bank transfer text |
| L10 | M49 Account security, activity, reach | 279 to 362 | Viewer two step verification and recovery codes, viewing activity, sign in history and new device email, sign out everywhere, playback caption settings, Google sign in, TV mode |

Before v2: lanes A to R3, V1 and W1 (about 180 PRs, PR 1 to 214 including plans, mockups and reviews). W1 added `release.yml`, the no email first deploy mode and the Dockerfile fix. The `cleanup` PR 386 and the production env template fix came after the lanes.

Counts: 57 main migrations (0000 to 0056) plus the keys database, decisions up to D-347, about 386 PRs.

## 2. Switched off by default

| Feature | How it is off | How to turn it on |
|---|---|---|
| Donations | `donate.enabled` is false, and it refuses to turn on without `PAYSTACK_SECRET_KEY`. `/donate`, `/api/donate/*` and the webhook answer 404 without the keys | Set `PAYSTACK_SECRET_KEY` and `DONATE_RECEIPT_TOKEN_SECRET`, then Settings, Monetization (`docs/DEPLOYMENT.md` section 14 has the go live order) |
| Monetization (sponsors) | `sponsors.enabled` and every `sponsors.placement.*.enabled` are false (a test asserts every enable switch in the group defaults to false) | Settings, Monetization, master switch needs the password again |
| Translation engine | `TRANSLATE_PROVIDER=none` (D-346). `google` needs `TRANSLATE_API_KEY` and a non zero `TRANSLATE_MONTHLY_CHAR_CAP`. No NLLB sidecar was built | Env, then request translations in Admin, Captions |
| Interface languages | English only. A language stays hidden until it reaches `i18n.publish_min_percent` (default 80) and is published in Admin, Languages | Admin, Languages |
| AirPlay and PiP | `features.airplay` is false, Super admin only. Not tried on a real device | Settings, Features, after a real iPhone and Apple TV test (`docs/spikes/airplay.md`) |
| Google sign in | No keys means the routes answer 404 and the button is hidden. The setting `features.signin_with_google` itself defaults to true | Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (both or neither) |
| Monthly giving | Not built. The setting `donate.monthly.enabled` exists, defaults to false and is refused unless donations are on (D-335). Blocked on a Paystack dashboard check of recurring plans | Needs slice 10 of L9 |
| Web push | Not built, skipped by L5 (the bell, the page and the email digest cover the need). No table and no VAPID keys exist | Needs new work |

On by default, so read before launch: guest play (`features.guest_play`, true, Super admin switch), viewer two step verification (`VIEWER_MFA_ENABLED=true`, optional for each viewer), guest audience `general`, maturity guest maximum 2. The email digest is opt in per viewer.

## 3. New environment variables

Every variable is in `.env.production.example` with a tag and validated in `packages/config/src/env.ts` (cross checks live there too). `pnpm secrets:generate` fills the generated ones. `packages/config/src/env.test.ts` and the production env test keep the example and the schema in step.

| Variable | Tag and default | Documented in |
|---|---|---|
| `PAYSTACK_SECRET_KEY` | owner, empty. `sk_test_` anywhere, `sk_live_` only in production | `docs/DEPLOYMENT.md` section 14, `docs/CLIENT-INPUTS.md` section 6 |
| `PAYSTACK_BASE_URL` | default `https://api.paystack.co`, test doubles only | `docs/DEPLOYMENT.md` section 14 |
| `DONATE_RECEIPT_TOKEN_SECRET` | generated, 32 bytes base64 | `docs/DEPLOYMENT.md` section 14 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | owner, empty, both or neither | `docs/CLIENT-INPUTS.md` section 3, `docs/SECURITY.md` |
| `VIEWER_MFA_ENABLED` | default true | `.env.production.example` and the decisions only (D-271 area). Not in a guide, see gaps |
| `TRANSLATE_PROVIDER` | default `none` (`google` or `fake`, `fake` refused in production) | `docs/CLIENT-INPUTS.md` section 7, `docs/SECURITY.md` |
| `TRANSLATE_API_KEY` | owner, required when the provider is `google` | `docs/CLIENT-INPUTS.md` section 7 |
| `TRANSLATE_MAX_CHARS_PER_JOB` | default 60000 | `.env.production.example`, D-292 |
| `TRANSLATE_MONTHLY_CHAR_CAP` | default 0 (nothing translates until it is raised) | `docs/CLIENT-INPUTS.md` section 7, D-292 |
| `WHISPER_MODEL_MULTI` | owner, empty. Needed to caption yo and ha audio automatically | `docs/CLIENT-INPUTS.md` section 7 |
| `EMAIL_HASH_PEPPER` (worker too) | generated. The worker uses it to skip suppressed addresses for the digest | `docs/DEPLOYMENT.md` section 6 |
| `DEV_PSEUDO_LOCALE` | development flag, refused in production, keep false | `.env.production.example` |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | owner, optional, both or neither. Guest abuse escalation now uses them too | `docs/DEPLOYMENT.md` section 3, `docs/ARCHITECTURE.md`, `docs/CLIENT-INPUTS.md` section 3 |

New settings (not env) that the owner or client may touch: the Monetization group (38 keys), `home.*`, `trending.*`, `maturity.*`, `features.guest_*`, `limits.guest_segment_minutes`, `playback.countdown_seconds`, the Discovery tab, `i18n.*`, `content.ui_languages`.

## 4. Migrations to apply

The docs do not record a deployed migration number, and `ai-context.md` lists a real VPS deploy as not done, so treat the first deploy as a fresh database: the `migrate` service applies every file in order, 0000 to 0056 (57 main files, two keys database files). Nothing needs to be picked by hand. If you are upgrading a database that ran the v1 build (migrations 0000 to 0035), the v2 set is 0036 to 0056, and 0044 to 0056 are the thirteen added after the sponsors and languages work:

| No | Name | Lane |
|---|---|---|
| 0036 | video_markers_chapters | L4 |
| 0037 | video_captions_switch | L3 |
| 0038 | maturity_ranks | L5 |
| 0039 | sponsors | L9 |
| 0040 | i18n_and_caption_languages | L7 |
| 0041 | sponsor_tracking | L9 |
| 0042 | title_ratings | L5 |
| 0043 | search_quality | L6 |
| 0044 | trending_rows | L5 |
| 0045 | row_kinds | L2 |
| 0046 | row_links | L2 |
| 0047 | login_events | L10 |
| 0048 | viewer_notices | L5 |
| 0049 | donations | L9 |
| 0050 | video_previews | L2 |
| 0051 | viewer_digest | L5 |
| 0052 | account_identities | L10 |
| 0053 | row_popular_fallback | L5 |
| 0054 | donation_checkout | L9 |
| 0055 | viewer_prefs_purge | L5 |
| 0056 | donation_review | L9 |

Notes: there are no duplicate numbers in `packages/db/migrations/main`. Migrations 0039 and 0043 have no drizzle snapshot, and the 0040 snapshot carries the sponsor tables, so run `drizzle-kit generate` carefully (L7 and L6 notes). Lane notes do not flag any migration as destructive. Migration 0052 relaxes the check `accounts_live_has_credentials` so an account can have no password. Decision text for it still says 0051 (renumbered on rebase), the file on disk is 0052.

## 5. Deploy steps

Source: `docs/DEPLOYMENT.md` sections 7, 8 and 10 and `docs/LAUNCH-RUNBOOK.md` (Release, step 7, Rollback).

1. Take a backup first (`docs/DEPLOYMENT.md` section 10). The first deploy has no previous release to roll back to, and destructive migrations need a fresh backup.
2. Build the images: GitHub, Actions, release, Run workflow on branch `main` (`workflow_dispatch`), or push a `v*` tag. It builds web, worker, whisper and tools for linux/amd64, scans with Trivy (a CRITICAL finding with a fix stops it before anything is pushed) and pushes to `ghcr.io/gabrielnig/angels-delight-tv-<name>` tagged with the full sha, short sha and tag. The tag to deploy is the full sha of the commit it ran on.
3. First time only: make the four GHCR packages public, or `docker login ghcr.io` on the VPS with a classic token that has only `read:packages`.
4. On the VPS as `deploy`: `ops/deploy.sh <full-sha>`. It checks out the ref, pulls, starts Postgres, runs the `migrate` service (a failure stops the deploy and the running release is untouched), restarts, waits up to 120 seconds for `/healthz`, and records `current` and `previous` in `/opt/angels-delight/.deploy/current`. If the new release is unhealthy it redeploys the previous one and exits non zero.
5. Check `https://<APP_DOMAIN>/api/ready`, then run the smoke checklist (runbook step 11) and `pnpm dns:check`.

Migration and rollback notes:
- Migrations follow expand and contract, so the previous image still works on the new schema. `ops/deploy.sh --rollback` redeploys `previous` without migrating.
- Restore the database only if data was damaged, with maintenance mode on (`touch` the `ON` flag in `MAINTENANCE_DIR`). A restore never targets the live database names, swapping traffic is manual.
- Edge Worker: `wrangler rollback`. Cloudflare settings: revert by hand from the audit log. After any rollback add a `LESSONS.md` entry.
- Donations: webhook URL, Cloudflare rate rule and WAF skip rule are in `docs/DEPLOYMENT.md` section 14, only needed when donations go live.
- Email: `SMTP_URL=disabled` lets the apps boot without credentials, but `pnpm dns:check` fails on `email-configured` until real SMTP is set.

## 6. Client questions and the defaults chosen

Full list with the config field for each: `docs/CLIENT-INPUTS.md`. Nothing is hardcoded, each answer is a `client.json` field or a setting. Where the client has not answered, the platform runs on these defaults.

| Question | Default chosen |
|---|---|
| Platform name, domain, logo, colours, font, legal text | Placeholders refused by `launch:apply`, so these must be supplied |
| Maturity labels | G, PG, 12, 15, 18 (`maturity.labels`) |
| Highest maturity a visitor without an account can see | Rank 2, so 12 (`maturity.guest_max_rank`) |
| Can visitors watch without an account | Yes (`features.guest_play`) |
| Audience a visitor sees before choosing | General, Kids mode is a device switch (`features.guest_audience`) |
| Languages | English only. yo, ig, ha have unreviewed sample drafts, Pidgin has none. Publish threshold 80 percent |
| Caption translation engine and speech model for other languages | None, the cap is 0 |
| Home sections | Six on a new site: Continue learning, My List, New this week, Most watched this week, Browse by subject, Series |
| Hero previews | Only on a fast link with Data saver off, an unknown connection is not eligible |
| Next episode countdown | 5 seconds (`playback.countdown_seconds`, 5 to 10) |
| Popular rows | 30 days, at least 5 views, at least 3 titles, else newest first (D-329) |
| Donations and sponsors | Off. If switched on: presets NGN 500, 1,000, 2,000, 5,000, minimum NGN 200, maximum NGN 5,000,000, NGN only, receipts make no tax claim |
| Organisation legal name and registration number | Not set (`donate.org_name`, `donate.org_registration`), required before donations |
| Transparency page figures | None, the owner must supply real ones |
| Storage notice wording | A placeholder text, the client must approve it |
| Guest segment link lifetime | 20 minutes (`limits.guest_segment_minutes`) |

## 7. Owner checklist (launch blockers)

Tick these before telling anyone the site is live. Items 1 to 9 block launch.

1. Real email. Put a real Brevo SMTP url in `SMTP_URL`, set `EMAIL_FROM` on a domain with SPF, DKIM and DMARC published, redeploy, then run `pnpm dns:check` until `email-configured` and the mail checks pass. Sign up, reset and digest mail all depend on it.
2. Legal pages and NDPA review. Terms, privacy, about and help text approved by the client and reviewed by a Nigerian practitioner. The privacy page must cover the guest cookie `__Host-ad_guest`, the Kids mode cookie `__Host-ad_gaud`, the anonymous analytics id (a keyed hash of the guest id and the day, never stored raw), the device keys listed in the storage inventory, and the data of children. List any hosted engine or error reporting host outside Nigeria as a cross border transfer.
3. Delete the 10 test clips: Admin, Videos, move to Trash, then delete forever, and confirm the storage estimate drops. Placeholder content is described in D-002.
4. Playback test on a desktop browser and on a phone over mobile data, a guest and a signed in account, with captions and seeking. No real faster-whisper run, edge Worker, R2 or screen reader pass has been done yet.
5. Backup and restore rehearsal: restore both dumps to a scratch Postgres, start the app on it, sign in, play a video (`docs/DEPLOYMENT.md` section 10, RPO 24 hours, RTO 4 hours).
6. Uptime monitor on `/healthz`, `/readyz` and `/api/health`, and the dead man's switch for the backup job.
7. Cloudflare account hardening: two factor authentication on and a new strong password, for the owner and every member.
8. Cloudflare Workers paid plan (about 5 USD a month). Open guest access means anyone with a link can start plays and the free plan stops at 100,000 requests a day, about 1,200 plays.
9. Run `pnpm perf:budget` against the deployed site and the Lighthouse job once. Total blocking time on Home was above target in M1.
10. Native review of the Yoruba, Igbo and Hausa drafts by a speaker of each language before any is published. The drafts were written without one and are marked unreviewed.
11. Paystack: confirm in the Paystack dashboard that recurring plans and subscriptions are available on the account before monthly giving is built and switched on. USD needs international payments and a domiciliary account.
12. Design skill mirror (owner, because the agent shell may not write inside `.claude/`): copy `packages/ui/src/tokens.css` over `.claude/skills/angels-delight-design-system/reference/tokens.css` (this also carries the six sponsor tokens), then change `it.skip` to `it` in `packages/ui/src/theme.test.ts` so the mirror check runs. Also add the Google mark colour exception to the skill grep (L10 plan 12.2).
13. Housekeeping: delete the remote lane branches on GitHub (the agent proxy blocks branch deletion) and bump the Trivy image tag deliberately when needed (fixed at 0.69.3).

## 8. Verification state

Done: scoped unit and integration tests per lane, design guard tests, doc sync tests, a clean decision id check (`scripts/decisions-ids.test.ts`, four old duplicates are registered at the top of `docs/DECISIONS.md`).

Not done anywhere: the Playwright specs written in v2 (`admin-l3-layout` ran once on a fixture build, but `guest-journey`, `guest-kids`, `admin-markers`, `watch-3g`, `tv` and the touch target and a11y extensions were written and never run), Docker image builds on a runner beyond the first release run, Cloudflare R2 and Worker deployment, real SMTP delivery, a real Whisper model, Google sign in and Paystack against real accounts, AirPlay on devices, a screen reader pass, throttled Android and Windows high contrast checks (L8 manual list).

## 9. Known gaps (from every lane note)

Open items from the v2 lanes, then older items that are still open or whose status needs a check.

L1 guest access
- M40-S18 Clear history on this device is not built.
- No audience select in the admin Features screen (use `client.json` or the settings API).
- (Closed by L13, D-375.) Series pages now show the Kids blocked screen to a guest in Kids mode, as the title page does.
- The sticky Play bar and the series main button do not follow device progress.
- The key route bucket `play-key-ip` still keys on the address (the session buckets are hashed).
- Journey specs were not run.

L2 home
- M41-S18 (upload your own preview clip) and S19 (viewer setting for previews) are Could items, not built.
- `--row-pad-block` still reserves room for the old thumbnail scale and can go in a tidy.
- Mockups S90 to S99 were never authored, the design skill was the reviewer.
- `packages/ui/test/focus-ring.test.ts` was failing for `.ad-bell__popover:focus` when L2 finished, recheck.

L3 admin
- Slice 16 (publish later) is not built, it needs a `publish_intent` migration and queue scheduler work (D-214).
- Docs left from slice 17: SECURITY matrix rows, the M16-S06 correction, M42 stories and MODULES row, DESIGN-SYSTEM entries, stories audit and plan edits E6 to E17 (check which landed).
- The breadcrumb Playwright measurement at 360, 390 and 1360 was not done for the breadcrumbs slice.

L4 player
- `savePlayerPrefsAction` has no server side kids lock on autoplay.
- Audio tracks wait for a second spoken language (the Audio row is dormant, D-245).
- AirPlay and PiP never tried on a real iPhone and Mac with Apple TV, so the flag stays off.
- TV keys (Up opens controls, Enter plays or pauses, captions inside the TV safe area) were handed to L4 by L10 and the L4 note does not say they were wired. Check before promising TV support.
- M43 has no row in `docs/MODULES.md` (the plan text exists in `docs/plan/v2/L4-player.md`).
- e2e specs `admin-markers`, `watch-3g` not run.

L5 engagement
- Web push not built (Could).
- Most liked on the series card, on the title page and in the card peek chip, the cross card live rating update (M44-S02 AC2), seed demo ranks, an admin filter by maturity, a web route key matrix test, the My List offline "Showing saved list" note, refreshing trending right after the nightly rollup.
- `messages-coverage.test.ts` listed three `sponsor.*` keys and later four unused `donate` and `sponsor` keys as unused on main (L7 and L9 notes), recheck with the scoped run.

L6 discovery
- Social image upload is a link for now (D-281).
- The share analytics channel event and Share from the player end card are not built.
- Wiring `hreflangAlternates` into page metadata waits for the locale URL prefix decision.
- `pnpm perf:budget` against live HTML reports images sized only by CSS (title poster, hero). LCP, CLS and INP are measured in the browser only.
- M26-S04 AC2 in the plan still says the Report link and is superseded by S14 AC3.

L7 languages
- Server components, `@ad/ui` component copy and the page titles under `app/` still hold inline English (wave not built). Known leftovers: `askedFor` in `DataPanel`, `CHECK_RUNNING_MESSAGE` in `useTurnstile.tsx`.
- No NLLB, LLM adapter or `apps/translate` sidecar (D-346). No Pidgin draft.
- `accounts.locale` was not read by `getLocale` in slice 4, slice 17 added it (check it in a real session).
- Still correct action and a screenshot mobile pass for the caption screens were not done, and no pixel pass for the Languages screens.
- The `yo`, `ig`, `ha` heading font rule now reaches the layout, but theme editor sample lines are not built.

L8 design system
- Row height reservation for skeletons and the hover card row gap compensation, hero arrows beside Pause, the Playwright hero text zone measurement at 360 and 390, the Night preset, a motion property allowlist test and a wider touch target list test.
- `scripts/design-doc-sync.test.ts` still has an `it.todo` for "ai-context decision number equals the highest DECISIONS heading" (R40). It was left as a todo because it would fail on every new decision.
- Manual checks nothing can prove: throttled Android scroll, Windows high contrast, screen reader on the hover card, yo, ig and ha samples at 360 px, lightest hero images against the scrim.

L9 monetization
- Monthly giving (slice 10), admin manual donation entry, USD hardening, Flutterwave, cover the fee option.
- The Donate link is in the footer only (no header link, no end of video card), no Turnstile on checkout (D-320).
- Admin has no failed or poison event list or refunds view, events stay visible in `payment_events`.
- The worker job that calls `sponsor_reach_prune()` was added later (`sponsors.reach_prune`, always on), confirm it runs in the first week.
- Sponsor card skeleton and a WatchClient kids test are not built (covered by the slice 14 matrix).
- Paystack has no documented `charge.failed` event, failures come from verify and the reconcile job.

L10 account and reach
- 16 exact edits to existing M01 to M35 stories (plan section 5.1) were not applied.
- The L4 player wiring for TV keys (see L4).
- e2e `tv` not run. Review finding 13 (`/activate`) does not apply, no code sign in exists.
- Google OAuth consent screen and redirect URI are a manual owner step.

Platform and older lanes (some may be stale, verify before acting)
- Auth emails (verify, reset) are not kept in the outbox in disabled email mode, by design (D-163).
- M33-S01 release version in the admin footer, and disk, error rate and certificate expiry alerts are monitor settings, not code (F1, DEPLOYMENT section 9).
- Catalog cache is per process, so a second web instance can be up to 60 seconds behind an edit (M2).
- Cards do not use the stored blur yet (F1), poster and hero files are not removed on purge (D, M3), `launch:apply` replaces only the four home screen icons (M3), email logos are WebP which Outlook desktop does not show (M3).
- Series hero art is not recut because series have no saved focus, and pictures processed before R2 part 2 keep an approximate crop preview (R2).
- Kids Continue Watching undo uses an in process stash of 5 minutes (K1). Pending deletion accounts do not show in the admin users list (M2).
- `pnpm format:check` reports 78 files not in Prettier style (V1). Storage contract tests against moto are skipped (V1).
- Open review items in `docs/QUALITY-REVIEW.md` section 2: the committer rule versus the GitHub merge API, and merging the two audit writers (`@ad/security` and `@ad/audit`).
- Lighthouse total blocking time on Home about 0.9 s against a 0.3 s target (M1), the budget is set just above the baseline.
