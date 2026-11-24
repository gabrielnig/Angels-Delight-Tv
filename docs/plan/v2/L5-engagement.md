# L5 Engagement plan (v2): likes and ratings, trending, viewer notifications, graded maturity, continue watching and My List polish

Status: planning pass, docs only. Date: 24 November 2026. Branch `plan/L5-engagement`. Module added: **M44 Engagement**. Evidence base: `docs/audits/2026-11-24-netflix-rea-audit.md` (sections 1, 3, 4, 5). Paths below are relative to the repo root and were checked against `origin/main` at commit 08d6e86.

Migration numbers are provisional. `main` stops at `0035_asset_poster_recut`, so this plan uses 0036 to 0040. Other v2 lanes plan migrations too, so the builder takes the next free number at rebase time and renumbers the file, the entry in `packages/db/migrations/main/meta/_journal.json` and the table in `docs/DATA-MODEL.md` section 12. Decision ids are written `L5-Dn` here and take the next free `D-` number from `docs/DECISIONS.md` (highest today is D-168) when logged.

## 1. Scope

In scope, in build order:

1. **Graded maturity** (slices 1 and 2). Done first because it widens `Audience` in `packages/catalog`, and every other slice reads through that type.
2. **Likes and ratings** (slices 3 to 5). Three levels per profile: Not for me, Like, Love. Shown on the title page and the hover card. Feeds a Most liked label and admin analytics. Guests are handled through the "sign in to save" dialog from lane L1, so this plan defines the interface (section 4.3).
3. **Trending and popular rows** (slice 6) from first party analytics, with window, minimum plays, caching, a cold start fallback and an optional numbered Top 10 row.
4. **Viewer notifications** (slices 7 to 9). In app bell for accounts, optional email digest through the existing outbox, web push as Could, settings per account, rules for kids profiles.
5. **Continue Watching polish and My List filters and sort** (slice 10).
6. Docs, stories, export and deletion coverage (slice 11).

Out of scope: personalised recommendation ranking (audit section 3, Skip), thumbs based "More like this" ranking (a later lane can read `title_ratings`, nothing here blocks it), social features (SECURITY.md section 12 says none), rating from the player, rating of individual episodes (a series is rated as a whole, like My List per M10-S05), push to guests.

Dependencies on other lanes:

- **L1 (guest access, sign in to save dialog).** Needs the `Viewer` union and `SignInToSaveGate`. This lane builds against the contract in section 4.3 with a local stub until L1 merges. Ratings for guests are never stored server side.
- **Home curation (M17)** owns `HomeCuration.tsx`. This lane adds three row kinds and their editor options, nothing else in that screen.
- **Email (M21)** owns `packages/queue/src/outbox.ts` and `packages/mailer`. This lane adds two outbox kinds and two templates through their existing extension points.
- **Platform and SEO lane (if any)** may add `VideoObject` JSON-LD for public pages. The maturity rating is exposed there as `contentRating`, see slice 2.

## 2. What exists today (code audit, verified in the repo)

- **No ratings code anywhere.** `grep -ri rating` finds nothing in `packages` or `apps` beyond unrelated words.
- **Popular row exists but is thin.** `popularTitles` in `packages/catalog/src/titles.ts` (line 455) sums `video_daily_stats.views` for the last `POPULAR_WINDOW_DAYS = 30`, only for `t.kind = 'video'`, so a **series can never appear**. The nightly rollup (`packages/analytics/src/rollup.ts`) only rebuilds yesterday and the day before, so "today" never counts. There is no minimum, no distinct viewer rule and no cache beyond the 60 second shared `catalogCache`. The row kind is `popular` in `ROW_KINDS` (`packages/shared/src/enums.ts`). There is no `trending` kind, which the owner punch list item 7 asks for.
- **Maturity is binary.** `videos.kids_safe` and `series.kids_safe` (booleans) plus `videos.suitability` text in `('everyone','kids','older')` (`packages/db/src/schema/content.ts` lines 113 to 151). `profiles.is_kids` (`identity.ts` line 113). The single predicate is in `packages/catalog/src/visibility.ts`: `Audience` is `{ kids: boolean }` and `liveVideoSql`, `liveSeriesSql`, `playableVideoSql` add `AND kids_safe` when `kids` is true. `audienceOf(profile)` in `packages/viewer/src/profiles.ts` line 77 builds it. Writers: `packages/catalog/src/admin/videos.ts` lines 419 and 726 set `kidsSafe` from `suitability`. Playback authorisation, keys, search, browse, related, My List, Continue Watching and Home all go through those three SQL fragments, so one change point exists (this is the design that makes slice 2 safe).
- **Notifications are staff only.** `admin_notices` and `staff_notification_prefs` (`packages/db/src/schema/notices.ts`), `NoticeBell.tsx` in the admin shell, the outbox (`email_outbox`, sealed address, dedupe key, suppression list) and the digest in `packages/queue/src/digest.ts`. The worker never reads `accounts` (D-129), so the staff prefs table stores its own sealed address. Viewers have no bell: `apps/web/src/components/ViewerChrome.tsx` lists Home, Browse, My List and so on, with no notification entry.
- **Continue Watching.** `loadContinueWatching` in `packages/viewer/src/progress.ts` already returns `nextUp` (true for a next episode at position 0, the "Next: E4" label of M09-S05 AC1) and a `progressVideoId`. **No UI reads `nextUp`**: `grep nextUp apps packages/ui` finds nothing outside the service. `CatalogCard.tsx` line 134 renders `ContinueCard` with a hardcoded row title "Continue watching", no episode label, and a permanently visible 44 px close button over the thumbnail (`ad-card__action--always`).
- **My List.** `listMyList` / `loadMyList` in `packages/viewer/src/my-list.ts` order by `added_at DESC, id DESC` only. `MyListGrid.tsx` shows "N saved", a hidden count, Show more (24 per page), and has no filter or sort. Cap is 500 in `DEFAULT_RULES.maxMyListItems` while `docs/DATA-MODEL.md` line 439 says 200 (doc mismatch, fixed in slice 11 by changing the doc to 500).
- **Analytics.** `view_events` carries `audience` (`general` or `kids`), a daily rotating `viewer_hash` (null for kids) and `profile_id` (null for kids, check constraints). `video_daily_stats` has views, watch time and completions per day. Raw events are kept 730 days.
- **Hover card.** `VideoCard` in `packages/ui/src/components/Cards.tsx` shows a `.ad-card__peek` overlay with description and a "Play" label, `aria-hidden`, revealed only by `.ad-card:hover` inside `@media (hover: hover)` (`components.css` line 1467). It is not revealed by `:focus-within` (only the action button is, line 1451), and it holds no interactive controls.
- **Icons.** `packages/ui/src/components/Icon.tsx` has no thumb, heart, bell, filter or sort glyph.

## 3. Design decisions that shape the plan

These are logged in section 9. Summary:

- Ratings are **per profile**, three levels stored as -1, 1, 2. Kids profiles **cannot rate** (SECURITY.md section 12: no personalisation signals for kids). Guests cannot rate server side.
- The **Most liked** label is computed, never typed in, and needs a minimum number of raters.
- **Trending** is a stored snapshot refreshed hourly, filtered for visibility and maturity at read time, and **hidden** (never faked) when data is thin.
- Maturity is a **five step rank** `0 to 4` on videos, series and profiles. Rank 0 equals today's `kids_safe`. A database trigger keeps `kids_safe` equal to `rank = 0`, so every existing query, test and the kids lock keep working unchanged.
- Notices are **per profile**, never for kids profiles. Email is **account level, opt in, generic content only**, and sent through the existing outbox.

## 4. Detailed design

### 4.1 Graded maturity

**Ladder.** Rank, default label, meaning:

| Rank | Default label | Meaning |
|---|---|---|
| 0 | G | All ages. Equals today's kids safe. The only rank a kids profile can see. |
| 1 | PG | Parental guidance suggested. |
| 2 | 12 | Suitable from 12. |
| 3 | 15 | Suitable from 15. |
| 4 | 18 | Adults only. |

The default labels follow the Nigerian film classification names. Labels are **configurable** site settings (`maturity.labels`, five short strings, 1 to 4 characters, validated) because the client may prefer plain words ("All ages", "7+", "13+", "16+", "18+"). Nothing in code compares labels, only ranks. This is the one client input of the lane (listed in section 10).

**Data (migration 0036 `maturity_ranks`).**

- `videos.maturity_rank smallint NULL`, `series.maturity_rank smallint NULL`, both `CHECK (maturity_rank BETWEEN 0 AND 4)`.
- `profiles.max_maturity_rank smallint NOT NULL DEFAULT 4 CHECK (max_maturity_rank BETWEEN 0 AND 4)`. Kids profiles are stored with 0 by a second check `CHECK (NOT is_kids OR max_maturity_rank = 0)`, so "kids maps to lowest" cannot be bypassed by any writer. The service sets 0 when `is_kids` turns on. When kids turns off it restores 2 (12) as the starting limit, the owner can change it right after (the existing password step of M03-S04 AC3 already guards that moment).
- Backfill in the same migration, in this order: `kids_safe = true` gives 0; else `suitability = 'older'` gives 3; else 2. A published video with no value yet is therefore rated 2, which is deliberately middle of the ladder: it does not appear for a profile limited to G or PG, and it is visible to everyone else. The editor can bulk correct from the Videos list (M16-S09).
- Trigger `videos_sync_kids_safe` and `series_sync_kids_safe` (BEFORE INSERT OR UPDATE OF maturity_rank): `NEW.kids_safe := (NEW.maturity_rank = 0)` when `maturity_rank IS NOT NULL`. When `maturity_rank IS NULL` the old column stays authoritative. This is the compatibility seam: the legacy writers keep working until slice 2 replaces them, and the generated `kids_safe` keeps feeding the existing index and predicate.
- `suitability` stays one release as a read only legacy column. The service stops writing it (mapping ranks back onto it would be wrong, because `everyone` means kids safe in the old code), and a later migration outside this lane drops it. The admin editor never reads it after slice 2.

**Visibility predicate.** `packages/catalog/src/types.ts`: `Audience` becomes `{ kids: boolean; maxRank?: number }`. `maxRank` absent means no rank filter (today's behaviour, so every untouched caller keeps its meaning). `packages/catalog/src/visibility.ts` adds `AND coalesce(t.maturity_rank, 4) <= ${audience.maxRank}` to `liveVideoSql` and `liveSeriesSql` when `maxRank` is defined and below 4. An unrated row counts as 4, so the filter **fails closed**. For a series, `liveSeriesSql` requires the series rank to be within the limit and at least one live episode to be within it; each episode is also filtered by its own rank in `liveVideoSql`, so a 15 episode inside a 12 series is hidden from a 12 profile while the rest of the series stays watchable. This is the rank version of M35-S01's series edge, restated in edit 1 of section 7.2.

`audienceOf(profile)` in `packages/viewer/src/profiles.ts` returns `{ kids: profile.isKids, maxRank: profile.isKids ? 0 : profile.maxMaturityRank }`. Guests (L1) use `{ kids: false, maxRank: siteSetting maturity.guestMaxRank }`, default 2, so anonymous visitors do not get 15 or 18 titles; it is logged as L5-D4.

Every consumer is covered because they all call these fragments; slice 2 adds a **route matrix test** that proves it per surface (home, browse, search, suggest, related, title, series, my list, continue watching, play session, key endpoint, hero, trending).

**Admin.** Video editor and publish dialog: the "Suitability" select becomes "Maturity rating" with the five labels and a one line help text. Publishing requires a value (M35-S04 AC2 already says so). Bulk edit (M16-S09) applies a rank atomically. Series editor sets the series rank and offers "Apply to all episodes" with a confirm. Audit entry on every change records old and new rank.

**Profile.** Edit profile (S11) gains "Maturity limit": a select "Allow titles rated up to" with the five labels. Lowering needs no password. **Raising it needs the account password** (reuse `ViewerContext.verifyPassword` and the `profile_pin` style rate bucket). Kids profile shows the control disabled with "Kids profiles only show titles for all ages." The `/api/profiles/[id]` body schema (`updateProfileBody` in `packages/viewer/src/schemas.ts`) gains `maxMaturityRank` (0 to 4). Concurrent edit protection uses the existing `expectedUpdatedAt`.

**Display.** The rating label shows as a small neutral `Badge` on the title page next to duration, on the hover card, and on the series header. Rank 0 titles show no badge on cards (less clutter, G is the norm on an educational site) but do show "G" on the title page. A badge is text, never colour alone.

**Migration plan and rollback.** Additive only. Step 1 migration 0036 with backfill and triggers. Step 2 (slice 2) switches readers and writers. Step 3 one release later, a separate migration drops `suitability`, outside this lane. Rollback of step 2 is a code revert: the columns and triggers are inert for old code. `kids_safe` is never removed. Verification query for the owner after deploy: counts of videos per rank and a list of videos where `kids_safe <> (maturity_rank = 0)` (must be empty).

### 4.2 Likes and ratings

**Data (migration 0037 `title_ratings`).**

```
title_ratings(
  profile_id uuid not null references profiles(id) on delete cascade,
  video_id uuid references videos(id) on delete cascade,
  series_id uuid references series(id) on delete cascade,
  value smallint not null check (value in (-1, 1, 2)),
  rated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(video_id, series_id) = 1)
)
unique (profile_id, video_id) where video_id is not null
unique (profile_id, series_id) where series_id is not null
index (video_id), index (series_id)
```

Same shape as `my_list` on purpose (one rated unit per title, episodes roll up to the series). RLS: `ENABLE` and `FORCE`, policy `title_ratings_owner FOR ALL USING (owns_profile(profile_id)) WITH CHECK (owns_profile(profile_id))`, exactly like `watch_progress` (migration 0029 pattern). Grants: `ad_app` SELECT, INSERT, UPDATE, DELETE. `ad_worker` gets **SELECT only through the aggregate function** below, not on the table (the worker must not read per profile ratings): `title_rating_aggregate()` is a `SECURITY DEFINER` function returning counts per title only, `EXECUTE` granted to `ad_worker` only. A CHECK constraint cannot look at another table, so "the profile is not kids" is enforced twice: by the service, and in the database by a **trigger** `title_ratings_not_kids` (BEFORE INSERT OR UPDATE, raises when the profile `is_kids`), with an integration test for both.

```
title_rating_stats(
  video_id uuid, series_id uuid, check exactly one,
  dislikes int not null default 0, likes int not null default 0, loves int not null default 0,
  most_liked boolean not null default false,
  updated_at timestamptz not null default now()
)
unique per video and per series
```

No RLS (catalog level aggregates, no profile data). `ad_app` SELECT, `ad_worker` full DML.

**Service (`packages/viewer/src/ratings.ts`, new).**

- `setRating(ctx, actor, { profileId, target: TitleRef, value: -1 | 1 | 2 | null }): Promise<{ value: RatingValue | null; updatedAt: string }>`. `null` clears. Verifies the profile is owned (`loadOwnedProfile`), **not kids** (`Forbidden('kids_no_rating')`), the title is visible through `fetchCards` with the profile audience (else `NotFound`, identical to My List), rejects an episode id (`BadRequest`: rate the series instead). Idempotent upsert, last write wins. Spends the new `engage` rate bucket (60 per 60 seconds per account, added to `VIEWER_RATE_POLICIES` in `packages/viewer/src/context.ts`).
- `getRatings(ctx, actor, { profileId, targets }): Promise<Map<id, RatingValue>>` used by the title page.
- `annotateCards` (`packages/viewer/src/annotate.ts`) gains `rating: RatingValue | null` and `mostLiked: boolean` on `TitleCardDto` so cards, the hover card, Home rows and My List all get them in one extra query (two `inArray` selects, same cost class as My List state today).
- `listMyRatings` for the data export.

**API.** `apps/web/src/app/api/ratings/route.ts` with `PUT` (set or clear) and `GET` (current value for `kind` and `id`). Uses `viewerRoute` and `createViewerApi` in `apps/web/src/server/viewer/api.ts` (`api.ratings.set`, `api.ratings.get`). Body schema `ratingBody` in `packages/viewer/src/schemas.ts`. Origin check, CSRF, and `guard()` apply as for `/api/my-list`. Kids lock: a kids session gets 403 `kids_no_rating`.

**Aggregation (worker).** Queue `ratings.rollup` (new entry in `QUEUES` and `QUEUE_DEFINITIONS`, concurrency 1, retry 3) on cron `*/15 * * * *` Africa/Lagos. It calls `title_rating_aggregate()`, upserts `title_rating_stats`, deletes stats for titles with no ratings, then recomputes `most_liked`:

- Eligible: `likes + loves + dislikes >= ratings.minRaters` (default 10) and `(likes + loves) / total >= ratings.minPositiveShare` (default 0.85).
- Among eligible, rank by the Wilson lower bound of the positive share, with loves counting as 2 positives out of a weight of 2 only for tie breaks. Label the top `max(1, min(ratings.maxLabelled (default 10), floor(eligible * 0.25)))`.
- A title with fewer than `minRaters` never gets a label and never shows a count to viewers.

Stats refresh every 15 minutes, so the title page may show a stale label for up to 15 minutes. The viewer's own rating is always live from `title_ratings`.

**UI (all new files in `apps/web/src/components/engage/`).**

- `RatingControl.tsx`: a group of three icon buttons (`role="group"`, `aria-label="Rate this title"`) using `aria-pressed`: Not for me (`thumb-down`), I like this (`thumb-up`), Love this (`heart`). Optimistic with rollback and a toast, `Undo` on clear, like `CatalogCard`. Selecting the active level clears it. 44 px targets, tooltips on hover only inside `@media (hover: hover)`, labels visible as text on the title page at 960 px and wider, icon only below that with `aria-label`.
- `RatingChip.tsx`: compact single thumb button for the hover card that expands to the three on hover or `:focus-within` (Netflix style) and is a full row of three on touch where it appears only on the title page.
- `MostLikedLabel.tsx`: a `Badge` "Most liked" with the thumb-up icon, shown on the title page and in the hover card when `card.mostLiked`.
- New icons in `packages/ui/src/components/Icon.tsx`: `thumb-up`, `thumb-down`, `heart`, `bell`, `sort`, `filter` (24 px stroke style like the others), each with a test in the existing icon test.
- Hover card change in `packages/ui/src/components/Cards.tsx` and `components.css`: the three card kinds get an `actions` cluster (`.ad-card__actions`) replacing the lone `.ad-card__action`, holding My List, rating chip, and (for videos) nothing else. The peek overlay stays decorative (`aria-hidden`) but is also revealed by `:focus-within` so keyboard users see the same information, and gets the maturity badge and "Most liked" text. The peek never holds a control (nested interactive content inside an `aria-hidden` region is a defect; controls live in the actions cluster).

**Guests.** `RatingControl` calls `useSignInToSave().ask({ kind: 'rate', target, value })` when `viewer.kind === 'guest'`. See 4.3. Nothing is stored for a guest, not even in `localStorage` (a rating is not progress; the audit's guest progress store stays for progress only).

**Admin analytics.** New `packages/analytics/src/ratings.ts`: `ratingTotals(db, range?)` returns, per title, `likes`, `loves`, `dislikes`, `positiveShare`, plus site totals. It reads `title_rating_stats` (not raw ratings). Privacy rule copied from M19-S04: a title with fewer than 10 ratings shows "Under 10 ratings" instead of counts. Wiring: `apps/web/src/lib/data/admin/analytics-real.ts`, `AnalyticsView.tsx` (Top titles table gains Likes, Love, Not for me and Positive columns, sortable; per video page gains a ratings tile), and the CSV export in `analytics-export.ts` (three columns, current totals). Admin never sees who rated.

### 4.3 Guest interface contract (agreed with L1)

L1 owns the dialog and the `Viewer` union. L5 depends on exactly this, in `apps/web/src/lib/viewer/intent.ts` (new, small, L5 creates it if L1 has not, L1 may move it):

```ts
export type PendingIntent =
  | { v: 1; kind: 'rate'; target: { kind: 'video' | 'series'; id: string }; value: -1 | 1 | 2 }
  | { v: 1; kind: 'my_list'; target: { kind: 'video' | 'series'; id: string } };

export interface SignInToSaveGate {
  viewerKind: 'account' | 'guest';
  /** Opens the "Sign in to save" dialog and stores the intent. Returns at once, never navigates by itself. */
  ask(intent: PendingIntent, opts?: { returnTo?: string }): void;
}
export function useSignInToSave(): SignInToSaveGate;
export function registerIntentHandler<K extends PendingIntent['kind']>(
  kind: K, run: (intent: Extract<PendingIntent, { kind: K }>) => Promise<void>): void;
```

- Storage: `sessionStorage` key `ad:intent:v1`, one intent, expires after 15 minutes, validated with zod on read, size capped at 512 bytes. Never `localStorage` (shared computers).
- Replay: an `IntentReplay` client component in the viewer layout runs after a successful sign in or sign up (it sees `viewer.kind === 'account'` and an intent). It calls the normal API (`PUT /api/ratings` or `POST /api/my-list`) with the **active profile** chosen in the profile picker, shows the toast "Saved to your profile", then clears the key. It never replays when the active profile is kids (rating is refused, the intent is dropped silently and the My List one is allowed).
- The dialog copy for a rating is owned by L1's component with a `reason` string from the caller: "Sign in to rate this title. Your rating helps others find it." Plain words, no dashes, one action "Sign in", one "Create account", and a quiet "Not now".
- Tests (L5 side): replay rate once, replay clears key, expired intent ignored, tampered JSON ignored, kids profile drops rate, guest never calls the API.

### 4.4 Trending and popular

**Definitions.**

- **Trending now**: plays in the last 7 Lagos days, newer days weigh more. `score = sum over days d of weight(d) * capped_plays(d)` with `weight = 0.8 ^ ageDays` (today is age 0) and `capped_plays` counting one viewer at most 3 plays of a title per day (`LEAST(count(*), 3)` grouped by video, day and `coalesce(viewer_hash, play_id::text)`; kids rows have no hash so each play counts). Completions add one extra play each. Series score is the sum of its live episodes. Config keys: `trending.windowDays` (7), `trending.decay` (0.8), `trending.perViewerDailyCap` (3).
- **Popular**: 30 day total views from `video_daily_stats` (today included from `view_events` live), series included as the sum of episodes. Existing `popularTitles` becomes a thin caller of the new shared function.
- **Top 10**: the Trending list shown as exactly 10 numbered tiles. Optional, default off.

**Thresholds.** A title qualifies when it has at least `trending.minPlays` (default 10) capped plays in the window. The row shows only when at least `trending.minTitles` (default 5) titles qualify for **that profile's audience** and the site had at least `trending.minSitePlays` (default 50) plays in the window. Top 10 needs 10 qualifying titles for the profile, else it is not rendered. Popular needs `popular.minViews` (default 5) per title and shows when at least 3 qualify.

**Cold start fallback.** Trending is **hidden, not relabelled**. Popular, when below threshold, falls back to newest only if the editor ticked "Fall back to newest" (existing `fallbackToNewest`), and then the row title shown is the editor's second title field "Newly added" (new `fallbackTitle` option) so a row never claims popularity it does not have. The default home layout at launch (owner item 7) seeds, in order: Continue Watching, My List, Trending now (smart), Newly added, then one row per category. Trending hides itself until traffic exists, so the seed is safe from day one.

**Storage and refresh (migration 0038 `trending_snapshot`).** `ALTER TYPE row_kind ADD VALUE` for `trending`, `top_ten`, `most_liked` (each as its own statement, and the new values are not used inside the migration; drizzle runs them outside a transaction block per statement-breakpoint). Table:

```
title_scores(kind text check in ('trending','popular'), video_id, series_id (exactly one),
  score double precision, plays int, rank int, computed_at timestamptz)
primary key per (kind, target); index (kind, rank)
```

Global, unfiltered top 60 per kind, no RLS (aggregate catalog data). `ad_app` SELECT, `ad_worker` full DML. Queue `trending.refresh`, cron `10 * * * *` Africa/Lagos, also enqueued by the nightly rollup handler after it finishes (so yesterday's final numbers are in). The refresh runs one SQL statement over `view_events` for the window (index `view_events_started_idx` exists), in one transaction replacing the kind's rows. It needs `ad_worker` SELECT on `view_events` (worker already runs the rollup, so check the grant in the migration test).

**Read path.** `packages/catalog/src/trending.ts` (new): `trendingTitles(tx, ctx, audience, { kind, limit })` joins `title_scores` to the titles CTE with `liveVideoSql` or `liveSeriesSql` for the audience (so unpublished, kids and maturity filters apply at read time), orders by `rank`, takes `limit`, and returns cards. The shown rank for Top 10 is the position **after filtering**, so a kids profile sees 1 to 10 of its own list. Wrapped in `shared()` with key `['trending', kind, audience.kids, audience.maxRank]` (60 second `catalogCache`, five audience tiers at most). A snapshot older than `trending.maxAgeHours` (default 3) is treated as empty and one warning is logged, and the Admin System page (`SystemView.tsx`) shows "Trending last refreshed".

**Row plumbing.** `resolveRow` in `packages/catalog/src/rows.ts` handles `trending`, `top_ten` (returns `rankStart` data) and `most_liked` (cards where `title_rating_stats.most_liked`, newest first). `ROW_KINDS` in `packages/shared/src/enums.ts` gains the three values and `rowKind` pgEnum follows. `TitleRow.kind` in `packages/viewer/src/home.ts` is already derived from `Exclude<RowKind,...>`, so the type follows; the web `HomeView` maps `top_ten` to a new `RankedRow` component in `apps/web/src/components/home/RankedRow.tsx` (ordered list `<ol>`, numeral plus tile, the link name starts "Number 3,"). Kids: `kidsVisible` still gates rows, and kids see kids only trending because the audience filter applies.

**Admin.** `HomeCuration.tsx` row type picker adds "Trending now", "Top 10" and "Most liked" with plain help text and the fall back option. Smart rows (M17-S06) text is updated.

**Privacy.** Kids plays contribute counts only (already anonymous). No per profile data enters a snapshot.

### 4.5 Viewer notifications

**What generates a notice.**

- `new_episode`: a series becomes watchable with a new episode, for each non-kids profile that **follows** the series. Follow means: the series is in the profile's My List, or the profile has `watch_progress` on any episode of it updated in the last 120 days. Several episodes in one fan out run collapse to one notice per series per profile ("3 new episodes of Title").
- `new_video`: a standalone video goes live. Not per video: one grouped notice per profile per Lagos day ("5 new videos") with the first three titles in the body. Only for profiles whose account has `newVideos` on (default on for the bell).

Detection needs no change in the publishing code (M28 owns scheduled promotion, other lanes touch it). `videos.announced_at timestamptz NULL` is added in migration 0039 and **backfilled to `now()` for every row that is already live**, so launch day does not flood anyone. Worker queue `notices.fanout`, cron `*/10 * * * *`, claims in one statement: `UPDATE videos SET announced_at = now() WHERE announced_at IS NULL AND <live predicate with the widest audience> RETURNING id, kind, ...`. Idempotent and crash safe through the unique `dedupe_key` on notices (`episode:<seriesId>:<profileId>:<yyyy-mm-dd>`, `video:<profileId>:<yyyy-mm-dd>`); a retried run does nothing twice. Notices are generated only if the title passes that profile's audience (maturity rank included), so a profile limited to PG never learns that a 15 episode exists.

**Data (migration 0039 `viewer_notices`).**

```
viewer_notices(
  id uuid pk, profile_id uuid not null references profiles(id) on delete cascade,
  kind text check in ('new_episode','new_video'),
  title text not null, body text not null default '', href text not null,
  series_id uuid references series(id) on delete cascade, video_id uuid references videos(id) on delete cascade,
  dedupe_key text not null, created_at, read_at, emailed_at)
unique (profile_id, dedupe_key); index (profile_id, created_at desc)
```

RLS owner policy via `owns_profile(profile_id)` for `ad_app` (SELECT, UPDATE of `read_at`, DELETE), worker role INSERT and SELECT and UPDATE of `emailed_at` (the worker bypasses `owns_profile` through an explicit `ad_worker` policy, as `admin_notices` does). A trigger refuses an insert for a kids profile (database level kids rule, tested).

```
viewer_notification_prefs(
  account_id uuid pk references accounts(id) on delete cascade,
  bell boolean not null default true,
  new_episodes boolean not null default true,
  new_videos boolean not null default true,
  email_frequency text not null default 'off' check in ('off','daily','weekly'),
  address_enc bytea, address_consented_at timestamptz,
  updated_at)
```

RLS `account_id = app_account_id()` for `ad_app`; `ad_worker` SELECT. The sealed address follows D-129 (`sealPrefsAddress` pattern in `packages/queue/src/digest.ts`): written by the web request when the owner switches email on, using the account email decrypted in the request, with scope `viewer-prefs:<accountId>`. If the owner changes their email (M02-S02) the address is re-sealed in the same transaction.

**Service and API.** `packages/viewer/src/notices.ts` (new): `listNotices`, `countUnread` (cheap, indexed, capped at 99), `markRead(ids | 'all')`, `getPrefs`, `setPrefs`. Routes `apps/web/src/app/api/notices/route.ts` (GET list, POST mark read) and `apps/web/src/app/api/notices/count/route.ts`, prefs under `apps/web/src/app/api/account/notifications/route.ts`. Kids lock: every route returns 403 `kids_no_notices` while a kids profile is active, and `count` returns 0 without touching the table. Rate bucket `api` applies.

**Bell UI.** `NoticeBell` equivalent for viewers in `apps/web/src/components/notices/ViewerBell.tsx`, mounted by `ViewerChrome.tsx` in the desktop top bar (right of search) and the mobile top bar. Desktop opens a popover list (latest 10, "See all", "Mark all as read"). Mobile opens `/notifications` (`apps/web/src/app/(viewer)/notifications/page.tsx`) as a normal page because popovers on 360 px are hostile. The badge is a number with a visually hidden "3 unread notifications", capped "9+", never colour alone. The count refreshes on route change and every 5 minutes while the tab is visible, **not at all under Data saver** (fetch on open only). The bell is **not rendered** for guests (no account) and not for kids.

**Email digest (Should).** Outbox kinds `viewer_digest_daily` and `viewer_digest_weekly` added to `OutboxKind` and `dispatch` in `packages/queue/src/outbox.ts`, templates in `packages/mailer/src/templates.ts` (HTML and text, one column under 30 KB, no tracking pixels, M21-S01 AC3). Queue `notices.digest`, cron `20 7 * * *` Africa/Lagos (weekly sends on Monday). For each account with `email_frequency <> 'off'`, a sealed address, and no entry in `email_suppressions`, it collects that account's unemailed notices from its **non-kids** profiles, merges them into at most 10 lines, titles and links only, enqueues one outbox row with `dedupeKey = viewer-digest:<accountId>:<yyyy-mm-dd>`, marks `emailed_at`. Privacy among household members: the email lists release facts only and never says which profile follows what; lines are limited by the **primary profile's** maturity limit. Every email carries a one click unsubscribe link (signed token, purpose new `unsubscribe_notices` in `TOKEN_PURPOSES`, no sign in needed, flips `email_frequency` to `off`) and the `List-Unsubscribe` header; the mailer adds the header from template metadata. Consent: email is **off by default**, switching it on is an explicit toggle recorded in `address_consented_at` (NDPA lawful basis is consent, SECURITY.md section 12).

**Web push (Could, migration 0040 `push_subscriptions`).** `push_subscriptions(id, account_id, endpoint_hash unique, endpoint_enc, p256dh_enc, auth_enc, user_agent_class, created_at, last_success_at, failed_count)` with RLS `account_id = app_account_id()`, secrets sealed with the field key. Needs VAPID keys (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in `@ad/config`, optional, the feature stays hidden when unset) and the `web-push` library. Service worker (`apps/web/src/app/sw.js/route.ts`) gains `push` and `notificationclick` handlers. Payloads are **generic**: "New on <site name>", count only, never a title, because a push can show on a locked device where a kids profile may be active and titles can be mature. Click opens `/notifications` (or `/` while a kids lock holds). Subscribe only from the account settings page, only when `Notification.permission` is granted by the user's own click, never prompted on load. Subscriptions are pruned after 3 consecutive failures or 30 days without success. Refused while a kids profile is active.

**Settings (account, adults only).** New card on `/account/notifications` (`apps/web/src/app/(account)/account/notifications/page.tsx`, linked from `AccountNav.tsx`): switches Bell, New episodes of series I follow, New videos; Email radio Off, Daily, Weekly (with the address shown masked and the consent line); Push button when supported. Copy never says "marketing". Security email is not here and cannot be turned off (M21-S05 edge).

**Kids profile rules (summary, all enforced server side and tested).**

1. No notices are ever generated for a kids profile (fanout filter and database trigger).
2. No bell, no `/notifications`, notice and pref routes answer 403 under the kids lock (`kids_gate` pattern).
3. Account level email never names a kids profile and reads only non-kids profiles' notices.
4. Push payloads are generic and subscribing is refused while a kids profile is active.
5. The settings page lives under `/account`, which a kids profile already cannot open (M35-S02).

**Retention.** Notices are kept 60 days and at most 100 per profile. Worker queue `notices.prune`, cron `40 3 * * *` Africa/Lagos, deletes beyond either limit. Read state is per profile.

### 4.6 Continue Watching polish and My List filters and sort

**Continue Watching (changes to `CatalogCard.tsx` ContinueRow, `packages/ui/src/components/Cards.tsx`, `packages/viewer/src/progress.ts` only if needed).**

1. Render the existing `nextUp` flag: a "Next: E4" `Badge` and meta line (M09-S05 AC1 is not met by the UI today). The `ContinueWatchingItem` DTO gets `episodeLabel` ("S1 E4") for episode cards, computed from `episodes` and `seasons` in the same query batch as `video`.
2. Replace the permanent close X with a **kebab menu** (`more` icon already exists): "Remove from row", "Go to title page", and later "Mark as watched" (M07-S07 Could). The menu is a real `role="menu"` popover with arrow key support and Escape, 44 px target, always visible on touch at low emphasis and on hover or focus on desktop, as DESIGN-SYSTEM 11.5 says for the My List button. Remove keeps the 6 second Undo toast (`removeContinueAction` and `restoreContinueAction` exist).
3. Row title comes from the curated descriptor (it already does in the service, `descriptor?.title`), the web row stops hardcoding "Continue watching".
4. Time left copy: "12 min left" under 1 hour, "1 h 05 min left" above, "Starts at the beginning" for next up.
5. Progress bar keeps `role="progressbar"` and the spoken text; add the episode label to the link's accessible name.
6. Kids profile: same card, no menu item "Go to title page" gap (the title page works for kids rank 0 titles), unchanged rules.

**My List filter and sort (`packages/viewer/src/my-list.ts`, `schemas.ts`, `MyListGrid.tsx`, new `MyListControls.tsx`).**

- Filter: All, Started, Not started. Started means a `watch_progress` row exists for the video, or for any episode of the series, with `position_ms >= minProgressMs` or `completed` (so a finished title counts as started). Not started is the complement. The filter and sort are in the **query**, not the client, so pagination stays correct.
- Sort: Newest added (default), Oldest added, A to Z, Z to A. A to Z uses `title_key` (the same normalised key browse uses, `packages/catalog/src/titles.ts`), cursor `{ k: titleKey, i: id }` like browse. Newest uses the existing `{ k: added_at, i }` cursor, Oldest the mirrored comparison.
- `myListQuery` gets `filter: 'all' | 'started' | 'not_started'` and `sort: 'newest' | 'oldest' | 'az' | 'za'`; both are in the URL (`/my-list?filter=started&sort=az`) so back and refresh keep them.
- `countMyList` returns the three counts for the pill labels ("Started 8"). `Hidden` message unchanged.
- Empty states per filter: "Nothing here yet. Start watching a title from your list and it shows here." and "Everything on your list has been started." with a "Show all" action.
- Offline: filter and sort work over the cached first page only and show "Showing saved list" like Home (M05-S08).

## 5. Build list (numbered slices)

Rules for every slice: branch from `origin/main` after `git fetch origin +refs/heads/main:refs/remotes/origin/main`, name `l5-sNN-short-name`, TDD (write the failing test, run only `pnpm vitest run <file>`, see red, build until green, never the full suite), `scripts/footprint-check.sh` before each commit, grep diffs for em and en dashes and emojis, commit as ARKDEV with a one line specific message, open the PR through `gh api`, rebase merge, no AI attribution. DB integration tests need `pg_ctlcluster 16 main start` and `TEST_DATABASE_ADMIN_URL`, stop the cluster at the end. UI slices run the `angels-delight-design-system` skill as reviewer and compare against mockups S120 to S129. Fixtures behind the dev flags for UI built before data lands (`apps/web/src/lib/data/fixtures/`).

### Slice 1. Maturity foundation (data and predicate)

Migration: `packages/db/migrations/main/0036_maturity_ranks.sql` (+ journal entry). Columns, checks, backfill, the two sync triggers, grants unchanged (profiles and videos already granted). RLS: `profiles` keeps `profiles_owner` (the new column is covered by it); `videos` and `series` have none (DATA-MODEL section 5). Add `MATURITY_RANKS`, `MaturityRank`, `MATURITY_DEFAULT_LABELS` to `packages/shared/src/enums.ts` and a `maturityLabel(rank, labels)` helper in `packages/shared/src/maturity.ts`.

Files: `packages/db/src/schema/content.ts`, `identity.ts` (columns, checks), `packages/shared/src/enums.ts`, `packages/shared/src/maturity.ts`, `packages/catalog/src/types.ts` (`Audience.maxRank`), `packages/catalog/src/visibility.ts`, `packages/viewer/src/profiles.ts` (`audienceOf`), `docs/DATA-MODEL.md` (sections 4.x videos, series, profiles, migration table).

Failing tests first (name, file):
- `maturityLabel falls back to defaults and clamps unknown ranks` in `packages/shared/src/maturity.test.ts`.
- `kids_safe follows maturity_rank through the trigger on insert and update` in `packages/db/src/maturity.int.test.ts`.
- `backfill maps kids_safe to 0, older to 3, everything else to 2` in the same file (seed legacy rows with the pre-0036 shape, run the migration SQL).
- `profiles check refuses a kids profile with a limit above 0` same file.
- `liveVideoSql without maxRank behaves exactly as before` and `liveVideoSql hides rank above maxRank and treats null rank as 4` in `packages/catalog/src/visibility.int.test.ts` (extend the existing file).
- `liveSeriesSql hides a series when its rank or all live episodes exceed the limit` same file.
- `audienceOf maps kids to rank 0 and an adult to its limit` in `packages/viewer/src/profiles.int.test.ts` (extend).

Worker jobs: none. Verification: `pnpm vitest run packages/db/src/maturity.int.test.ts packages/catalog/src/visibility.int.test.ts`.

### Slice 2. Maturity admin, profile limit, enforcement matrix

Files: `packages/catalog/src/admin/videos.ts` (lines 419 and 726: write `maturityRank`, derive nothing from `suitability`), `packages/catalog/src/admin/types.ts` (DTO `maturityRank`, keep `suitability` read only for one release), `packages/catalog/src/admin/series.ts` (series rank, apply to episodes), `packages/catalog/src/publishing.ts` (checklist item `maturity` replaces the suitability item), `packages/viewer/src/profiles.ts` (`updateProfile` accepts `maxMaturityRank`, raising needs the password, spends `profile_pin` bucket, writes 0 for kids), `schemas.ts`, `apps/web/src/components/admin/VideoEditor.tsx`, `PublishDialog.tsx`, `VideosList.tsx` (bulk), `SeriesEditor.tsx`, `apps/web/src/components/profiles/ProfileForm.tsx`, `apps/web/src/lib/data/types.ts` (Profile gets `maxMaturityRank`), `apps/web/src/server/data/mappers.ts`, `real-profiles.ts`, `apps/web/src/lib/data/admin/*` for the labels, site setting `maturity.labels` and `maturity.guestMaxRank` in the M29 settings registry, `apps/web/src/components/title/TitleView.tsx` (badge), `packages/ui/src/components/Cards.tsx` (chip in peek), seed data `packages/catalog/src/seed-demo.ts` (demo videos get ranks).

Failing tests first:
- `setting a rank updates kids_safe and writes an audit entry with old and new` in `packages/catalog/src/admin/videos.int.test.ts`.
- `publish is blocked until a maturity rating is chosen` in `packages/catalog/src/publishing.int.test.ts`.
- `bulk rank change is all or nothing and reports failed ids` in `packages/catalog/src/admin/videos-page.int.test.ts`.
- `raising a profile limit needs the account password, lowering does not` in `packages/viewer/src/profiles.int.test.ts`.
- `a kids profile limit is always 0 and cannot be raised` same file.
- Route matrix `a 12 profile cannot see, search, open, list, play or fetch a key for a 15 title` in `packages/viewer/src/security.int.test.ts` (one table driven test over home, browse, search, suggest, related, title, series, my list, continue watching, play session) and the key route test in `apps/web/src/server/viewer/api.int.test.ts`.
- `unrated titles are hidden from limited profiles` same matrix.
- Component tests: `ProfileForm shows the maturity select and a password step when raising` in `apps/web/src/components/profiles/ProfileForm.test.tsx` (extend), `VideoEditor shows Maturity rating with five options` in `VideoEditor.test.tsx`, `TitleView shows the rating badge` in `TitleView.test.tsx`.

Migration: none (0036 already). Worker: none. Verification: scoped files above plus design review against S126 and S127.

### Slice 3. Ratings data and service

Migration: `0037_title_ratings.sql` as in 4.2: tables, owner RLS, kids trigger, `title_rating_aggregate()` SECURITY DEFINER function, grants. Files: `packages/db/src/schema/engage.ts` (new, exported from `schema/index.ts`), `packages/viewer/src/ratings.ts`, `packages/viewer/src/annotate.ts`, `packages/viewer/src/context.ts` (`engage` bucket), `schemas.ts`, `packages/viewer/src/index.ts`, `docs/DATA-MODEL.md` (new section 7.4 and migration rows), `docs/SECURITY.md` (section 7 rate table, section 12 line).

Failing tests first (`packages/viewer/src/ratings.int.test.ts` and `packages/db/src/ratings.int.test.ts`):
- `a profile can like, love, dislike and clear a title` / `setting the same value twice is idempotent` / `an episode id is rejected`.
- `a kids profile cannot rate and the trigger blocks a direct insert`.
- `account A cannot read or write account B ratings (RLS)`, `no context sees zero rows`.
- `a title hidden for the profile audience returns NotFound`.
- `annotateCards returns rating and mostLiked for videos and series`.
- `rating writes are rate limited at 60 per minute`.
- `ratings are removed when a profile is deleted` and `when a video is deleted`.
- `the aggregate function returns counts without profile ids`.

### Slice 4. Ratings API and UI (title page, hover card, guest intent)

Files: `apps/web/src/app/api/ratings/route.ts`, `apps/web/src/server/viewer/api.ts` (`ratings` group), `apps/web/src/components/engage/RatingControl.tsx`, `RatingChip.tsx`, `MostLikedLabel.tsx`, `apps/web/src/lib/viewer/intent.ts` plus `IntentReplay.tsx`, `apps/web/src/components/title/TitleActions.tsx` and `TitleView.tsx`, `apps/web/src/components/CatalogCard.tsx`, `packages/ui/src/components/Cards.tsx`, `Icon.tsx`, `components.css`, `apps/web/src/lib/data/types.ts` (`CatalogItem.rating`, `mostLiked`), `fixtures`, `apps/web/src/lib/data/index.ts` (data access `setRating`), `apps/web/src/server/data/real-library.ts`.

Failing tests first:
- `PUT /api/ratings sets and clears, rejects bad bodies, 403 for kids lock, 401 without session` in `apps/web/src/server/viewer/api.int.test.ts` (extend) and `api-kids-lock.int.test.ts` (extend).
- `RatingControl is a labelled group with aria-pressed and a roving state` / `selecting the active level clears it` / `rolls back and shows an error toast on failure` / `guest click calls ask and does not call the API` in `apps/web/src/components/engage/RatingControl.test.tsx`.
- `IntentReplay replays a stored rating once after sign in, ignores expired and tampered intents, drops it for kids` in `apps/web/src/lib/viewer/intent.test.ts`.
- `VideoCard actions cluster holds My List and rating chip, peek shows on focus-within` in `packages/ui/src/components/Cards.test.tsx` (extend).
- `Icon exposes thumb-up, thumb-down, heart, bell, sort, filter` in `packages/ui/src/components/Icon.test.tsx` (add if absent).
- `TitleView shows Most liked and the rating group at 360 and 1280 widths` in `TitleView.test.tsx`.

### Slice 5. Rating stats, Most liked, admin analytics

Migration: `title_rating_stats` is in 0037. Files: `packages/queue/src/definitions.ts` (`ratings.rollup`, cron entry in a new `ENGAGE_CRON_SCHEDULES`), `packages/analytics/src/ratings.ts`, `packages/analytics/src/index.ts`, `apps/worker/src/engage.ts` (new handler module, registered from `apps/worker/src/handlers.ts` and `main.ts` the same way maintenance is), `apps/worker/src/engage.int.test.ts`, `apps/web/src/lib/data/admin/analytics-real.ts`, `analytics-export.ts`, `apps/web/src/components/admin/AnalyticsView.tsx`.

Failing tests first:
- `rollup counts likes, loves, dislikes per title and removes stats when ratings are gone` (`engage.int.test.ts`).
- `most liked needs the minimum raters and positive share and caps the labelled count` and `ties and a single eligible title still get one label`.
- `rerunning the rollup does not change results` (idempotent).
- `ratingTotals hides counts under 10 ratings` in `packages/analytics/src/ratings.test.ts`.
- `queue definitions include ratings.rollup with concurrency 1 and a cron` in `packages/queue/src/definitions.test.ts` (extend).
- `Top titles table sorts by positive share and shows Under 10 ratings` in `AnalyticsView.test.tsx`.
- `CSV export includes the three rating columns and neutralises formulas` in `analytics-export.test.ts`.

### Slice 6. Trending, popular, Top 10 rows

Migration: `0038_trending_rows.sql` (enum values, `title_scores`, grants, `ad_worker` SELECT on `view_events` if missing). Files: `packages/shared/src/enums.ts` (`ROW_KINDS`), `packages/db/src/schema/enums.ts` and `engage.ts`, `packages/catalog/src/trending.ts` (+ export), `packages/catalog/src/rows.ts` (`resolveRow` cases, `fallbackTitle`), `packages/catalog/src/titles.ts` (`popularTitles` delegates, series included), `packages/analytics/src/trending.ts` (the score SQL and `refreshTrending(db, now, config)`), `apps/worker/src/engage.ts` (`trending.refresh`), `packages/queue/src/definitions.ts`, `apps/web/src/components/home/RankedRow.tsx`, `HomeView.tsx`, `LazyHomeRows.tsx`, `apps/web/src/components/admin/HomeCuration.tsx` and `apps/web/src/lib/data/admin/home-rules.ts`, `SystemView.tsx`, seed default rows in `packages/catalog/src/seed-demo.ts` and the launch seed (`packages/launch`), settings registry for the `trending.*` keys.

Failing tests first:
- `refreshTrending weights newer days higher and caps one viewer at 3 plays a day` (`packages/analytics/src/trending.int.test.ts`).
- `kids plays count one each, no hash needed`, `completions add weight`, `series score is the sum of live episodes`.
- `titles under the minimum plays are excluded and an empty site writes no rows`.
- `rerunning refresh replaces rows and a crash mid run leaves the old snapshot`.
- `trendingTitles drops unpublished, kids unsafe and above limit titles and keeps order` and `Top 10 rank is the position after filtering` (`packages/catalog/src/trending.int.test.ts`).
- `trending row is not returned below minTitles or minSitePlays` / `a stale snapshot is treated as empty` / `popular falls back to newest only when asked and uses the fallback title`.
- `getHome resolves trending, top_ten and most_liked rows and annotates them` (`packages/viewer/src/home.int.test.ts` extend).
- `RankedRow renders an ordered list with numbers in the link name` (`RankedRow.test.tsx`).
- `HomeCuration offers the three new row types with help text` (`HomeCuration.test.tsx`).
- Cache: `shared cache key varies by audience tier` (`packages/viewer/src/catalog-cache.int.test.ts` extend).

### Slice 7. Viewer notices (data, fanout, bell)

Migration: `0039_viewer_notices.sql` (`viewer_notices`, `viewer_notification_prefs`, `videos.announced_at` plus backfill, kids trigger, RLS, grants). Files: `packages/db/src/schema/engage.ts`, `packages/viewer/src/notices.ts`, `schemas.ts`, `apps/web/src/server/viewer/api.ts`, the three API routes of 4.5, `apps/web/src/components/notices/ViewerBell.tsx`, `NoticeList.tsx`, `apps/web/src/app/(viewer)/notifications/page.tsx` and `loading.tsx`, `ViewerChrome.tsx`, `packages/ui/src/components/TopNav.tsx` (bell slot), `packages/queue/src/definitions.ts` (`notices.fanout`, `notices.prune`), `apps/worker/src/notices.ts` + registration, `apps/web/src/lib/data/fixtures` for the bell.

Failing tests first (`apps/worker/src/notices.int.test.ts`, `packages/viewer/src/notices.int.test.ts`):
- `fanout creates a new_episode notice for profiles that have the series in My List or watched it in 120 days`.
- `fanout skips kids profiles and profiles whose limit is below the title rank`.
- `three new episodes in one run make one notice per series per profile`.
- `new videos make one grouped notice per profile per day`.
- `running fanout twice creates nothing new (dedupe key)` and `a crash after claiming is safe`.
- `launch backfill marks existing live videos announced so no notices appear`.
- `unread count is capped at 99, mark read per profile does not clear another profile` / `mark all`.
- `account A cannot read account B notices (RLS)` / `kids lock returns 403 and count 0` / `insert for a kids profile fails at the database`.
- `prune removes notices older than 60 days and keeps 100 per profile`.
- Components: `ViewerBell shows a number with a spoken label, caps at 9+, is absent for guests and kids, does not poll under data saver` in `ViewerBell.test.tsx`; `notifications page lists, marks read, empty state` in `notifications-page.test.tsx`; `ViewerChrome renders the bell slot only for adult accounts` in `ViewerChrome.test.tsx` (extend).

### Slice 8. Notification settings and email digest

Files: `apps/web/src/app/(account)/account/notifications/page.tsx`, `apps/web/src/components/account/NotificationSettings.tsx`, `AccountNav.tsx`, `apps/web/src/app/api/account/notifications/route.ts`, `packages/viewer/src/notices.ts` (prefs, sealing), `packages/queue/src/outbox.ts` (kinds, `dispatch`), `packages/queue/src/viewer-digest.ts`, `packages/mailer/src/templates.ts` (+ `mailer.ts` for the `List-Unsubscribe` header), `packages/shared/src/enums.ts` (`unsubscribe_notices` purpose), `packages/db/src/schema/auth` token purpose check if constrained, `apps/web/src/app/unsubscribe/notices/page.tsx` and route, `apps/worker/src/notices.ts` (`notices.digest`), `docs/DEPLOYMENT.md` (sender, unsubscribe domain note).

Failing tests first:
- `switching email on seals the address and records consent; switching off clears it` (`notices.int.test.ts`).
- `changing the account email re-seals the preference address`.
- `digest sends one outbox row per account per day with dedupe key and at most 10 lines` / `skips suppressed addresses and accounts with email off` / `never includes notices of kids profiles` / `limits lines by the primary profile maturity limit` / `weekly sends on Monday only` (`packages/queue/src/viewer-digest.int.test.ts`).
- `template renders html and text, under 30 KB, includes unsubscribe link and header, no tracking pixel, never prints undefined` (`packages/mailer/src/templates.test.ts` extend).
- `unsubscribe token flips frequency to off without signing in, is single purpose and expires` (`apps/web/src/app/unsubscribe/notices/route.test.ts`).
- `NotificationSettings toggles save optimistically, show the masked address and the consent line, hide push when unsupported` (`NotificationSettings.test.tsx`).
- `kids profile cannot open the settings route (password gate)` in the existing account kids lock test.

### Slice 9. Web push (Could)

Migration `0040_push_subscriptions.sql`. Files: `packages/db/src/schema/engage.ts`, `packages/config/src/*` (optional VAPID keys), `packages/viewer/src/push.ts`, `apps/web/src/app/api/account/push/route.ts`, `apps/web/src/app/sw.js/route.ts`, `apps/worker/src/notices.ts` (send after fanout), `apps/web/src/components/account/NotificationSettings.tsx`.

Failing tests first: `subscribe stores sealed keys and refuses while a kids profile is active`; `payload is generic and carries no title`; `three failures or 30 days without success prunes the subscription`; `feature is hidden when VAPID keys are unset`; `service worker push and notificationclick handlers open /notifications, or / under a kids lock` (`apps/web/src/app/sw.test.ts`); RLS test for `push_subscriptions`.

### Slice 10. Continue Watching polish and My List filters and sort

No migration. Files: `packages/viewer/src/progress.ts` (`episodeLabel`), `packages/viewer/src/my-list.ts`, `packages/viewer/src/schemas.ts`, `apps/web/src/app/api/my-list/route.ts`, `apps/web/src/app/(viewer)/my-list/page.tsx`, `apps/web/src/components/mylist/MyListControls.tsx`, `MyListGrid.tsx`, `MyListScreen.tsx`, `apps/web/src/app/actions.ts` (`loadMoreMyListAction` takes filter and sort), `apps/web/src/components/CatalogCard.tsx`, `packages/ui/src/components/Cards.tsx` (`ContinueCard`: badge, label, kebab), `Menu` primitive if none exists in `packages/ui` (`packages/ui/src/components/Menu.tsx`, new), `apps/web/src/lib/format.ts` (`timeLeftLabel`).

Failing tests first:
- `my list filter started includes finished titles and series with a started episode` / `not started is the exact complement` / `sort az uses title_key and pages without duplicates or gaps` / `oldest first and newest first cursors are stable under inserts` / `filter and sort respect kids and maturity` (`packages/viewer/src/my-list.int.test.ts` extend).
- `countMyList returns all, started and not started counts` same file.
- `GET /api/my-list validates filter and sort` (`api.int.test.ts`).
- `MyListControls reads and writes the URL, announces the new count, empty states per filter` (`MyListControls.test.tsx`).
- `ContinueCard shows Next: E4, the episode label, time left, and a kebab menu with Remove and Go to title page; menu is keyboard operable and closes on Escape` (`Cards.test.tsx`).
- `row title comes from the descriptor` (`CatalogCard` test file, create `ContinueRow.test.tsx`).
- `loadContinueWatching returns episodeLabel for episodes and null for standalone videos` (`progress.int.test.ts` extend).

### Slice 11. Documentation, stories, export, deletion, lane notes

Files: `docs/USER-STORIES.md` (module M44 and the edits in section 7), `docs/MODULES.md` (index row M44 and a module section), `docs/SCREEN-ARCHITECTURE.md` (new `/notifications`, `/account/notifications`, row kinds, bell), `docs/DATA-MODEL.md` (sections and migration rows 0036 to 0040, My List cap 500), `docs/SECURITY.md` (sections 5 capability table, 7 rate table, 10 PII table: ratings, notices, push subscriptions with retention, 12 kids rules), `docs/DESIGN-SYSTEM.md` (11.19 badges: maturity badge and Most liked, 11.5 cards actions cluster, new 11.27 Rating control, 11.28 Notification bell and list, 11.29 Ranked row), `docs/DECISIONS.md` (section 9), `docs/CLIENT-INPUTS.md` (maturity labels, guest max rank), `docs/lanes/L5-engagement.md` (what exists, APIs, routes, scoped test commands, gaps), `CHANGELOG.md` (append). Data export (`apps/web/src/server/data/export-jobs.ts`, `packages/viewer` `listMyRatings`): add `ratings.json` and `notices.json` to the export; deletion already cascades through `profiles` and `accounts` foreign keys, the purge job test gains assertions.

Failing tests first: `export includes ratings and notices for every profile of the account and nothing of other accounts` (`apps/web/src/server/data/export-jobs.int.test.ts` extend); `account purge leaves no ratings, notices, prefs or push subscriptions` (`packages/auth/src/account.int.test.ts` or the purge test that exists, extend); `docs guard`: the repo has doc consistency checks, run `pnpm vitest run` only on the touched guard files.

### Slice order and merge plan

1, 2 (maturity) merge first, in two PRs. 3, 4, 5 (ratings) three PRs. 6 (trending) one PR, can run in parallel with 3 to 5 after slice 1 merges since it only needs `Audience.maxRank`. 7, 8, 9 (notices) three PRs, 7 needs slice 1 for the maturity filter. 10 one PR, independent, can start any time. 11 last. Expect conflicts on `packages/queue/src/definitions.ts`, `packages/shared/src/enums.ts`, `docs/DECISIONS.md`, `CHANGELOG.md` and the migration journal: resolve by keeping both and renumbering.

## 6. Worker jobs (all new queues in `packages/queue/src/definitions.ts`)

| Queue | Cron (Africa/Lagos) | Purpose | Definition |
|---|---|---|---|
| `ratings.rollup` | `*/15 * * * *` | Recompute `title_rating_stats` and `most_liked` | concurrency 1, retry 3, delay 30 s, backoff, expire 5 min |
| `trending.refresh` | `10 * * * *` and after `analytics.rollup` | Rebuild `title_scores` for trending and popular | concurrency 1, retry 3, delay 60 s, backoff, expire 10 min |
| `notices.fanout` | `*/10 * * * *` | Claim newly live videos, write per profile notices | concurrency 1, retry 3, delay 30 s, backoff, expire 5 min |
| `notices.digest` | `20 7 * * *` (weekly on Monday) | Queue viewer digest email through the outbox | concurrency 1, retry 3, delay 120 s, backoff, expire 15 min |
| `notices.prune` | `40 3 * * *` | Delete notices past 60 days or 100 per profile, stale push subscriptions | concurrency 1, retry 2, expire 10 min |

All register through `registerWorker` with the job mirror, so they show in the Admin System page like the others. Failures alert through the existing health digest. Each job is idempotent (documented per job in the lane notes) and each has a test that runs it twice.

## 7. Stories

### 7.1 New module M44 (append to `docs/USER-STORIES.md` after M43, or after M36 if M37 to M43 are not yet merged, and add the M44 row to `docs/MODULES.md`)

Module index row: `| M44 | Engagement (ratings, trending, notifications, graded maturity) | Viewer | [CLIENT] |` (CLIENT because the maturity labels are a client input, everything else is READY). Dependencies: M03, M04, M05, M07, M09, M10, M17, M19, M21, M35, M01 and lane L1.

## M44 Engagement

### M44-S01 Rate a title (Must)
As a viewer, I want to tell the platform what I think of a title, so that I can find good ones again and others can too.
- AC1: Given I am signed in on an adult profile and open a title or series page, When I look at the actions, Then I see a group "Rate this title" with Not for me, I like this and Love this.
- AC2: Given I choose one, When I tap it, Then it shows pressed at once (optimistic), the other two are not pressed, and a toast says "Rating saved".
- AC3: Given I choose the level that is already pressed, When I tap it, Then my rating is cleared and the toast offers Undo for 6 seconds.
- AC4: Given the server rejects the change, When it fails, Then the control reverts and a persistent error toast says "We could not save your rating. Try again."
- Edge: ratings belong to the profile, another profile on the account has its own. Rating a series rates the whole series, episodes cannot be rated on their own. Rating twice is idempotent.
- Error: the title was unpublished meanwhile, show "This title is no longer available" and keep the control disabled.
- Empty: a title never rated shows no pressed button.

### M44-S02 Change or review my ratings (Should)
As a viewer, I want to see what I rated, so that I can change my mind.
- AC1: Given I have rated titles, When I open a card or page for one, Then my level shows pressed.
- AC2: Given I change a rating, When it saves, Then every card of that title on the current page updates.
- Edge: ratings of titles that were unpublished are kept and return if the title returns.
- Error: not applicable.
- Empty: not applicable.

### M44-S03 Ratings on the title page and the hover card (Must)
As a viewer, I want to rate from where I choose, so that it takes one tap.
- AC1: Given a desktop with a mouse, When a card is hovered for 300 ms (ruling R10) or focused, Then a thumb button shows in the card actions beside My List and expands to the three levels on hover or focus.
- AC2: Given a touch device, When I look at a card, Then there is no rating control on the card, and the title page has the full group.
- AC3: Given a keyboard user, When focus is on a card, Then Tab reaches My List and the rating chip, the hover overlay text is shown on focus too, and every control has an accessible name.
- AC4: Given a title page at 360 px, When it loads, Then Play is a full width button and My List, rating group and Share sit in a second row with 44 px targets and no horizontal scroll.
- Edge: Data saver does not change the controls.
- Error: failure behaves as in M44-S01.
- Empty: not applicable.

### M44-S04 Guests are asked to sign in to save a rating (Should)
As a visitor without an account, I want a clear way to keep my rating, so that I can join when I am ready.
- AC1: Given I am a guest, When I tap a rating, Then the "Sign in to save" dialog opens with the reason "Sign in to rate this title" and nothing is stored on the server or the device except the pending intent.
- AC2: Given I sign in or sign up, When I return to the title, Then my rating is applied once to my chosen profile and a toast says "Saved to your profile".
- AC3: Given the intent is older than 15 minutes or was tampered with, When I return, Then it is ignored.
- AC4: Given I choose a kids profile after signing in, When the intent is a rating, Then it is dropped silently.
- Edge: I tap Not now, the dialog closes and the control stays unpressed.
- Error: replay failure shows "We could not save your rating. Try again." and keeps the control usable.
- Empty: not applicable.

### M44-S05 Most liked label (Should)
As a viewer, I want to see which titles people liked most, so that I can pick well.
- AC1: Given a title has at least 10 ratings and at least 85 percent Like or Love, When it ranks in the top quarter of eligible titles (at most 10), Then the title page and hover card show a "Most liked" label.
- AC2: Given fewer than 10 ratings, When the page loads, Then no label and no count show to viewers.
- AC3: Given the numbers change, When the 15 minute rollup runs, Then labels update.
- Edge: one eligible title still gets the label. Counts are never shown to viewers.
- Error: if stats cannot load, the label is omitted and the page works.
- Empty: new platform, no labels.

### M44-S06 Admin rating analytics (Should)
As an admin, I want to see how titles are rated, so that I can make more of what people like.
- AC1: Given `/admin/analytics`, When Top titles shows, Then columns Likes, Love, Not for me and Positive share are available and sortable.
- AC2: Given a title with fewer than 10 ratings, When shown, Then it says "Under 10 ratings" instead of counts.
- AC3: Given the CSV export, When I export, Then the three counts are included as current totals.
- Edge: no rater identity is ever shown.
- Error: partial failure shows retry per tile (as M19-S02).
- Empty: "No ratings yet".

### M44-S07 Trending now row (Must)
As a viewer, I want to see what others are watching now, so that I can join in.
- AC1: Given the Trending now row, When Home loads, Then it lists up to 20 titles ranked by plays in the last 7 Lagos days, newer days weighing more, filtered for my profile (kids and maturity).
- AC2: Given fewer than 5 titles have at least 10 plays, or the site had fewer than 50 plays in the window, When Home loads, Then the row is not rendered (no fake trending).
- AC3: Given one viewer plays a title many times in a day, When counted, Then that viewer adds at most 3 plays per day.
- AC4: Given the snapshot is older than 3 hours, When Home loads, Then the row is not rendered and an admin warning shows on the System page.
- Edge: series appear, scored by their episodes.
- Error: row failure shows the inline row retry like M05-S02.
- Empty: row not rendered.

### M44-S08 Popular row and cold start (Must)
As an admin, I want a Popular row that is honest on a new site, so that Home is never empty or misleading.
- AC1: Given the Popular row, When Home loads, Then it lists titles by views in the last 30 days with at least 5 views each, series included.
- AC2: Given fewer than 3 titles qualify and "Fall back to newest" is ticked, When Home loads, Then the row shows with the editor's fallback title (default "Newly added") and newest titles.
- AC3: Given fewer than 3 qualify and the option is off, When Home loads, Then the row is not rendered.
- Edge: kids profiles see kid titles only.
- Error: as M44-S07.
- Empty: as AC3.

### M44-S09 Top 10 numbered row (Could)
As a viewer, I want a clear top ten list, so that I know what is biggest.
- AC1: Given Top 10 is switched on in Home curation, When 10 titles qualify for my profile, Then the row shows exactly 10 tiles numbered 1 to 10 after my filters.
- AC2: Given fewer than 10 qualify, When Home loads, Then the row is not rendered.
- AC3: Given a screen reader, When the row is read, Then it is an ordered list and each link starts with "Number 3,".
- Edge: the numeral is large display type on a scrim, never the only way to tell rank (position and text carry it).
- Error: as M44-S07.
- Empty: not rendered.

### M44-S10 Curate the new row kinds (Should)
As an editor, I want to add Trending, Top 10 and Most liked rows, so that Home stays fresh with no weekly work.
- AC1: Given Home curation, When I add a row, Then the type list includes Trending now, Top 10, Most liked with one line of help each.
- AC2: Given a Popular row, When I edit it, Then I can tick "Fall back to newest" and set the fallback title.
- AC3: Given a launch seed, When the site is first set up, Then rows exist in this order: Continue Watching, My List, Trending now, Newly added, one per category.
- Edge: kids visibility is set per row as today.
- Error: save failure keeps my edits and shows retry.
- Empty: not applicable.

### M44-S11 Notification bell for viewers (Must)
As a viewer, I want a bell that tells me about new things, so that I come back.
- AC1: Given I am signed in on an adult profile, When there are unread notices, Then the bell shows the count (9+ above 9) with a spoken "3 unread notifications".
- AC2: Given I open the bell on desktop, When the popover opens, Then I see the latest 10 with "Mark all as read" and "See all"; on a phone it opens `/notifications`.
- AC3: Given I tap a notice, When it opens, Then it is marked read and goes to the title or series page.
- AC4: Given Data saver is on, When I browse, Then the count is fetched only when I open the bell.
- Edge: read state is per profile.
- Error: load failure shows "We could not load notifications. Try again."
- Empty: "Nothing new. We will tell you when something arrives."

### M44-S12 New episode notices (Must)
As a viewer, I want to know when a series I follow has a new episode, so that I keep watching.
- AC1: Given a series is in my My List or I watched an episode in the last 120 days, When a new episode goes live, Then I get one notice "3 new episodes of <title>" per run.
- AC2: Given the episode is above my profile's maturity limit, When it goes live, Then I get no notice.
- AC3: Given the job runs twice, When it finishes, Then I have exactly one notice.
- Edge: scheduled publishing counts when the promotion time passes. Videos that were live before launch never notify.
- Error: a failed run retries and never creates a duplicate.
- Empty: not applicable.

### M44-S13 New video notices (Should)
As a viewer, I want a daily note when new videos arrive, so that I can browse them.
- AC1: Given new standalone videos went live today, When the job runs, Then I get one grouped notice per day, "5 new videos", with the first three titles.
- AC2: Given I switched "New videos" off, When videos go live, Then no notice is created.
- Edge: videos above my maturity limit are not counted.
- Error: as M44-S12.
- Empty: not applicable.

### M44-S14 Notification settings per account (Must)
As an account owner, I want to choose what I am told, so that I am not flooded.
- AC1: Given `/account/notifications`, When I open it, Then I can switch Bell, New episodes and New videos, choose email Off, Daily or Weekly, and see my masked address.
- AC2: Given email is off by default, When I switch it on, Then the page states in one line what will be sent and I confirm, and the consent time is recorded.
- AC3: Given I change my account email, When it saves, Then the email notification address follows.
- Edge: security emails cannot be turned off and are not listed.
- Error: save failure reverts the switch and shows an error toast.
- Empty: not applicable.

### M44-S15 Email digest (Should)
As an account owner who opted in, I want one short email, so that I hear about new things without checking the site.
- AC1: Given email is Daily or Weekly, When the digest job runs at 07:20 Lagos time (Monday for weekly), Then I get one email with at most 10 lines (title and link), HTML and plain text, under 30 KB, no tracking pixels.
- AC2: Given my address is on the suppression list, When the job runs, Then nothing is sent.
- AC3: Given the email, When I open it, Then it has a one click Unsubscribe link and the List-Unsubscribe header, and the link works without signing in.
- AC4: Given the email content, When it is built, Then it never names a profile, never includes kids profile activity, and is limited by the primary profile's maturity limit.
- Edge: no notices means no email. Copy follows UI writing rules.
- Error: provider outage queues the mail with the outbox retry rules (M21-S01).
- Empty: not applicable.

### M44-S16 Web push (Could)
As a viewer on a phone, I want a push when something new arrives, so that I do not miss it.
- AC1: Given push is supported and configured, When I press "Turn on push" on the settings page, Then the browser asks permission only after that press, and a subscription is stored sealed.
- AC2: Given a push is sent, When it shows, Then it says "New on <site name>" with a count and no title.
- AC3: Given I tap it, When it opens, Then I land on `/notifications` (or Home under a kids lock).
- Edge: three failed sends or 30 days without success remove the subscription.
- Error: permission denied shows how to allow it, without nagging.
- Empty: the button is hidden when push is not configured.

### M44-S17 Kids profile notification rules (Must)
As a parent, I want notifications to stay out of kids profiles, so that children see nothing they should not.
- AC1: Given a kids profile is active, When any page loads, Then no bell shows and `/notifications` shows "This is not available on this profile".
- AC2: Given a kids profile exists, When new titles go live, Then no notices are created for it.
- AC3: Given the notification API, When called under a kids lock, Then it answers 403 and the count is 0.
- AC4: Given push, When a kids profile is active, Then subscribing is refused.
- Edge: switching to an adult profile restores the bell after the password step.
- Error: not applicable.
- Empty: not applicable.

### M44-S18 Admin sets a maturity rating (Must)
As an admin, I want to rate each title on a five step scale, so that profiles can be limited precisely.
- AC1: Given I edit a video or series, When I choose a Maturity rating (default labels G, PG, 12, 15, 18), Then it saves and an audit entry records old and new value.
- AC2: Given no rating is chosen, When I try to publish, Then publishing is blocked with "Choose a maturity rating".
- AC3: Given I bulk select videos, When I apply a rating, Then all update or none do, and failed ids are listed.
- AC4: Given a series, When I set its rating, Then I can apply it to all episodes after a confirm.
- Edge: labels come from site settings and can be renamed without code.
- Error: validation shows the five valid values.
- Empty: not applicable.

### M44-S19 Profile maturity limit (Must)
As a parent, I want to set the highest rating each profile may watch, so that each person sees what suits them.
- AC1: Given Edit profile on an adult profile, When I choose "Allow titles rated up to", Then the limit saves and applies at once to every list, search and playback.
- AC2: Given I raise the limit, When I save, Then I must enter the account password.
- AC3: Given I lower the limit, When I save, Then no password is needed.
- AC4: Given a kids profile, When I open its settings, Then the limit is fixed at the lowest rating and says why.
- Edge: turning Kids off sets the limit to 12 and I can change it right away; the last adult profile rules of M03-S10 still apply.
- Error: wrong password shows "That password is not right" and keeps the old limit. Concurrent edit shows "This profile changed. Reload."
- Empty: not applicable.

### M44-S20 Maturity is enforced everywhere (Must)
As a parent, I want the limit to hold on every path, so that it cannot be bypassed.
- AC1: Given a profile limited to 12, When it opens Home, Browse, Search, suggestions, Related, My List, Continue Watching, a series page, a title URL or a watch URL, Then titles rated above 12 or unrated never appear and direct links answer as not found.
- AC2: Given a playback session or key request for such a title, When made, Then it is refused.
- AC3: Given the filter cannot be evaluated, When a query fails, Then the result is empty, never unfiltered (fail closed).
- Edge: titles in My List above the limit are kept and hidden, with the existing hidden count message.
- Error: not applicable.
- Empty: as M35-S01.

### M44-S21 Maturity badge (Should)
As a viewer, I want to see a title's rating before I play, so that I know what to expect.
- AC1: Given a title page, When it loads, Then the rating label shows next to the duration, with a visually hidden full phrase "Rated 15".
- AC2: Given a card on desktop hover or focus, When the overlay shows, Then it includes the rating label unless the title is G.
- Edge: labels follow the site setting.
- Error: not applicable.
- Empty: unrated titles are not visible to limited profiles, so no empty badge appears.

### M44-S22 Legacy compatibility and migration (Must)
As the developer, I want the new ratings to keep the old kids flag working, so that nothing breaks during rollout.
- AC1: Given the migration runs, When it completes, Then every video and series has a rank (kids safe titles 0, "older" 3, the rest 2) and `kids_safe` equals rank 0 everywhere.
- AC2: Given any writer sets a rank, When it saves, Then `kids_safe` follows by trigger.
- AC3: Given the old API fields, When read, Then they still return the same values for one release.
- Edge: rollback of the code leaves the data valid.
- Error: a mismatch between `kids_safe` and rank is reported by a check query in the runbook.
- Empty: not applicable.

### M44-S23 Continue Watching polish (Should)
As a viewer, I want the row to say exactly where I am, so that I resume with confidence.
- AC1: Given an episode card, When shown, Then it carries "S1 E4", and a "Next: E4" badge when the card is the next episode at position 0.
- AC2: Given any card, When shown, Then the time left reads "12 min left" or "1 h 05 min left".
- AC3: Given I open the card menu (kebab), When I choose "Remove from row", Then the card disappears at once with Undo for 6 seconds; "Go to title page" opens the title.
- AC4: Given a keyboard, When the menu is open, Then arrow keys move, Enter chooses, Escape closes and focus returns to the kebab.
- Edge: the row title comes from curation.
- Error: failure restores the card with an error toast.
- Empty: not shown when empty.

### M44-S24 My List filters and sort (Should)
As a viewer with a long list, I want to filter and sort it, so that I find what I need.
- AC1: Given `/my-list`, When I choose All, Started or Not started, Then the grid shows only those, with a count on each choice, and the choice is in the URL.
- AC2: Given I choose Newest added, Oldest added, A to Z or Z to A, When applied, Then the order changes in the query and pages of 24 stay in order without repeats.
- AC3: Given a filter has no results, When shown, Then I see a plain sentence and a "Show all" action.
- AC4: Given I am offline, When I open the list, Then I see the saved first page with "Showing saved list".
- Edge: a finished title counts as Started. A series counts as Started when any episode is started. Kids and maturity limits apply.
- Error: load failure shows retry and keeps the choices.
- Empty: as M10-S03.

### M44-S25 Engagement data privacy and deletion (Must)
As a viewer, I want my ratings and notices handled with care, so that I can trust the platform.
- AC1: Given my data export, When it is ready, Then it includes my ratings and notices for each profile.
- AC2: Given account deletion completes, When the purge runs, Then ratings, notices, notification settings and push subscriptions are gone.
- AC3: Given the privacy page, When viewed, Then it states what is stored (ratings per profile, notices, optional email and push settings) and for how long (notices 60 days).
- AC4: Given analytics, When counted, Then only totals per title are used and no rater is identifiable; kids profiles contribute no ratings.
- Edge: deleting a profile deletes its ratings and notices.
- Error: partial purge retries until complete (M32-S03).
- Empty: not applicable.

### 7.2 Exact edits to existing stories

Apply each as a replacement of the named line or an appended line, in `docs/USER-STORIES.md`.

1. **M35-S01 AC1.** Replace `Then results contain only titles with suitability `kids`, enforced in the query, not in the UI.` with `Then results contain only titles with maturity rank 0 (G), enforced in the query, not in the UI.` Add after AC3: `- AC4: Given an adult profile with a maturity limit (M44-S19), When any list is requested, Then titles above the limit or without a rating never appear, enforced in the query.` Edge unchanged except: `a series is shown on a kids profile only when all its published episodes are kid suitable (or by series flag)` becomes `a series is shown to a profile only when the series and at least one live episode are within the profile limit`.
2. **M35-S04 title and AC1 to AC3.** Rename `Admin sets title suitability` to `Admin sets title maturity rating (superseded by M44-S18, kept for kids filtering)`. AC1 `set suitability` becomes `set the maturity rating`. AC2 `a warning requires me to choose a value (default for new videos is `general`, not `kids`)` becomes `publishing is blocked until a maturity rating is chosen (no default, so nothing is rated G by accident)`. AC3 `apply suitability` becomes `apply a maturity rating`. The "kids, general or mature" sentence in the story text becomes "on a five step maturity scale".
3. **M03-S04.** Insert AC5: `Given I open Edit profile on an adult profile, When I change "Allow titles rated up to", Then the new limit applies at once, and raising it needs the account password (M44-S19).` Change AC2 end to `... hide titles above the kids limit (rank 0) ...`.
4. **M03-S10 AC2.** `kid suitable titles only` becomes `titles rated G only`.
5. **M05-S02 AC4.** Append: `The row types Trending now, Top 10 and Most liked follow the same card and arrow rules (M44-S07, S09, S10).`
6. **M05-S03 AC2.** Replace `a lightweight overlay shows description and quick actions (Play, My List) with no video preview (data friendly)` with `a lightweight overlay shows description, the maturity label (unless G), a Most liked label when earned, and quick actions (Play, My List, rating) with no video preview (data friendly). The overlay is also shown on keyboard focus, and the controls sit outside the aria-hidden text.`
7. **M05-S05.** Add `Edge: the Continue Watching card follows M44-S23.`
8. **M07-S01 AC1.** Insert after `caption badge (CC)`: `maturity label, Most liked label when earned, the rating group (M44-S01)`.
9. **M07-S05 AC1.** Replace `respecting kids filter` with `respecting the kids filter and the profile maturity limit`.
10. **M07-S06 (public preview).** Append AC3: `Given I am signed out and tap a rating or My List, When the dialog opens, Then it is the Sign in to save dialog and my choice is applied after sign in (M44-S04).`
11. **M09-S05 AC1.** Append: `The card shows the "Next: E4" badge and the episode label (M44-S23).`
12. **M09-S07 AC1.** Replace `When I open its menu and choose "Remove from row"` with `When I open its kebab menu and choose "Remove from row"` (menu defined in M44-S23).
13. **M10-S03 AC1.** Replace `items show as a grid newest added first with card details` with `items show as a grid, newest added first by default, with card details, and filter and sort controls (M44-S24)`.
14. **M17-S02.** Append to the row types sentence: `Row types also include Trending now, Top 10 and Most liked (M44-S10).`
15. **M17-S06 AC2.** Replace `Most watched this week, When rolled up daily, Then top titles by views of the last 7 days appear` with `Trending now, When refreshed hourly, Then top titles by weighted plays of the last 7 Lagos days appear (M44-S07)`. Error: replace `no data falls back to newest` with `thin data hides the row, and Popular may fall back to newest when ticked (M44-S08)`.
16. **M19-S03 AC1.** Append `Likes, Love, Not for me and Positive share columns are available (M44-S06).`
17. **M21-S05.** Append Edge: `Viewer notification settings are separate and live at /account/notifications (M44-S14).`
18. **M25-S03 (Data saver).** Append AC: `Given Data saver is on, When I browse, Then the notification count is fetched only when I open the bell (M44-S11).`
19. **M29-S02 AC1.** Append to the flag list: `maturity labels, guest maximum rating, trending window and minimums, Most liked minimums, notice retention`.
20. **M32-S03 AC1.** Insert `ratings, notices, notification settings, push subscriptions` after `progress`.
21. **M02-S05 (export).** Append `The export includes ratings and notices per profile (M44-S25).`
22. **M02-S04 / account navigation.** Add `Notifications` to the account area list (M44-S14).
23. **M16-S09 (bulk edit).** Replace `suitability` with `maturity rating` where it appears.
24. **M01-S13 / M01-S14 and M10-S01 (L1 guest stories).** When L1 lands, add to the guest My List and rating dialog stories: `the same dialog and pending intent store serve ratings (M44-S04)`. L1 owns the text, this lane only cross references.

Counts: 25 new stories (M44-S01 to S25): 13 Must (S01, S03, S07, S08, S11, S12, S14, S17, S18, S19, S20, S22, S25), 10 Should (S02, S04, S05, S06, S10, S13, S15, S21, S23, S24), 2 Could (S09, S16). 24 edits to existing stories.

## 8. UI review of affected screens (against the audit and the design skill)

Reviewed with the skill checklist (tokens, contrast, states, keyboard and focus, 44 px, skeletons, reduced motion, copy rules, mobile first) and audit sections 2, 3 and 4. Findings are concrete and each maps to a slice.

**Title page (S18, `TitleView.tsx`, `TitleActions.tsx`).**
1. No rating control and no label slot. Add `RatingControl` to the second action row of the `layout="title"` variant. At 360 px the row is My List, three rating buttons, Share: 5 x 44 px plus 4 x 8 px gaps = 252 px, fits. Labels become visible text from 960 px (audit 3: three level rating on the title page). Slice 4.
2. Maturity badge and "Most liked" must use the existing `Badge` (`neutral` for rank, a new `accent-soft` is not needed: use `info`) with icon plus text, never colour alone (design skill, status rule). The accent yellow is never text (section 4.2): the Most liked badge text uses `--color-on-accent` only on an accent fill, otherwise neutral. Slice 2 and 4.
3. Toggle feedback: `TitleActions` toasts "Added to My List" without Undo while `CatalogCard` has Undo. Make both consistent when touched (rating clear needs Undo). Slice 4.
4. Description collapse (4 lines) and Related row unchanged. Public preview for guests (`PublicTitle`) hides the rating group and shows the sign in dialog on tap, so guests still see a prompt, not a dead end (audit section 5: no hard redirects).

**Cards and hover card (`packages/ui/src/components/Cards.tsx`, `components.css`).**
5. The peek overlay is `aria-hidden`, shown only by `.ad-card:hover` inside `@media (hover: hover)` and not by `:focus-within` (`components.css` line 1451 reveals the action only). Keyboard users never see the description or Play label. Fix: reveal the peek on `:focus-within` as well. Slice 4.
6. A single absolute `ad-card__action` button cannot take a second control. Replace with a flex `ad-card__actions` cluster, 44 px targets with 4 px gaps, top right. On touch the cluster keeps only My List at low emphasis (DESIGN-SYSTEM 11.5) and rating lives on the title page. Slice 4.
7. Ruling R10 supersedes this item: L8 governs the card hover. Scale 1.25 after a 300 ms delay on `hover: hover and pointer: fine` devices only, no delay on mouse out, transform origin left for the first visible card and right for the last. The L5 peek and actions cluster ride on that scaled card and stay transform and opacity only. Not a defect here.
8. Maturity chip in the peek: text on the scrim chip, contrast computed against `--color-player-control-bg`, 4.5:1 minimum. Check in the slice review.

**Home rows (`HomeView.tsx`, `Row`).**
9. `Row` heading is the curated title and a real `h2`: reuse for Trending and Most liked. Top 10 needs its own `RankedRow` (ordered list, numeral). The numeral is display type from `var(--font-display)` on a scrim, size from the type scale (`--text-h1`), not a hardcoded px, and not outlined text (no token for strokes). Skeleton geometry for ranked tiles must reserve the numeral width to avoid layout shift (design skill). Slice 6.
10. Rows that fail show an inline retry already (`RowError`), the new rows reuse it. Hidden rows leave no empty heading (M05-S05 edge).

**Continue Watching (`CatalogCard.tsx` ContinueRow, `ContinueCard`).**
11. `nextUp` is computed by the service but never shown, so M09-S05 AC1 ("Next: E4") is unmet. Slice 10.
12. The close button is always visible at the top right over the thumbnail (`ad-card__action--always`), a destructive control one mis-tap away and it competes with the duration badge. Replace with a kebab menu (DESIGN-SYSTEM 11.5 says reveal on hover and focus, low emphasis on touch). Slice 10.
13. The row title is hardcoded "Continue watching" in the web component while the service sends the curated title (M17 rename does nothing for this row on the web). Slice 10.
14. Keep: progress bar with `role="progressbar"` and spoken percent, 4 px rail (matches design doc), time left meta.

**My List (S20, `MyListGrid.tsx`).**
15. No filter or sort, only "N saved". Add a control row (pills for All, Started, Not started with counts, a Sort select) using the existing `Pill` and select patterns (DESIGN-SYSTEM 11.11): solid fill when active, neutral border when inactive, `aria-pressed` on pills, the select labelled "Sort by". On 360 px the pills scroll horizontally inside their own container and the sort select sits on its own row; targets 44 px. Slice 10.
16. The count line is `aria-live="polite"`: reuse it to announce "8 started" after a filter change. The hidden items message stays.
17. Empty state copy exists for the empty list only; add per filter empty states (copy in M44-S24). Skeleton on filter change: keep the grid height with skeleton cards at card ratio after 300 ms (design skill), do not flash an empty state.

**Navigation and bell (`ViewerChrome.tsx`, `TopNav.tsx`).**
18. No notification entry exists in the viewer nav. Add the bell at the right of the top bar, 44 px, badge as text with spoken label, popover with focus trap and Escape (Modal rules, section 11.12) on desktop, a full page on phones. Mobile bottom tab bar is unchanged (bell stays in the top bar). Not rendered for guests or kids. Slice 7.
19. No bell glyph in `Icon.tsx`. Add `bell` with the same 24 px stroke style. Slice 4 adds the icon set once.

**Profile edit and manage (S10, S11, `ProfileForm.tsx`).**
20. Add the "Allow titles rated up to" select under the Kids switch. When Kids is on it is disabled with a sentence, not hidden, so the rule is visible (design skill: explain disabled). The password step reuses the existing kids to adult password dialog pattern (M03-S04 AC3). Slice 2.
21. Audit unchecked item: `.ad-tile:focus-visible { outline: none }` (`components.css` line 997) replaces the outline with a `box-shadow` on the avatar. Box shadows disappear in Windows forced colours mode, so the focus ring is invisible there. Fix while in the profile screens: add `outline: 3px solid transparent` (visible in forced colours) next to the shadow. Small, in `components.css`, test in `Profiles` component test. Slice 2.

**Account settings (S29 pattern, `AccountNav.tsx`).**
22. New `/account/notifications` follows the playback settings card pattern (`PlaybackSettings.tsx`): switches with visible labels, radio group for email with a legend, masked address, consent line, push button only when supported. Copy review: no "marketing", no dashes, no emojis. Slice 8.

**Admin (S45 video edit, S47 publish dialog, S55 curation, S60 and S61 analytics).**
23. Rename "Suitability" to "Maturity rating" with a select (not radio, five options) and helper text; publish checklist item. Bulk bar label updates. Slice 2.
24. Analytics tables gain four columns: check the table stays usable at 1280 px (admin tables use horizontal scroll with a sticky first column; verify) and the "Under 10 ratings" text is not colour only. Slice 5.
25. Home curation: three new row types in the picker with one line help each, and a fallback checkbox with its own label. Slice 6.

**Cross cutting.** Reduced motion: expansion of the rating chip uses opacity and transform only, instant under `prefers-reduced-motion: reduce`. Hover rules wrapped in `@media (hover: hover) and (pointer: fine)`. Copy uses plain words: "Not for me", "I like this", "Love this", "Rating saved", "Nothing new". No emojis (the thumb and heart are SVG icons from `Icon.tsx`). No dashes in any string, template or comment.

## 9. Decisions to log in `docs/DECISIONS.md` (recommended option chosen)

Use the next free `D-` number at build time. Format as in the file: decision, options, why, reversible.

- **L5-D1 Ratings are three levels per profile, stored -1, 1, 2, kids cannot rate.** Options: five stars, thumbs up or down only, per account. Chosen: Netflix style three level per profile. Why: matches the audit, gives a clear Most liked rule, keeps kids data free of personalisation signals (SECURITY.md section 12). Reversible: yes (values map to stars later).
- **L5-D2 Ratings are for the whole title, a series is rated as one.** Options: rate episodes, rate both. Why: matches My List (M10-S05) and keeps counts meaningful. Reversible: yes (additive episode column later).
- **L5-D3 Most liked is computed: at least 10 raters, 85 percent positive, top quarter of eligible with a cap of 10, refreshed every 15 minutes.** Options: manual flag, Wilson only, bigger minimums. Why: honest on a small audience and cheap. All numbers are site settings. Reversible: yes.
- **L5-D4 Maturity is a five step rank 0 to 4 with configurable labels (default G, PG, 12, 15, 18), rank 0 equals kids safe, guests default to a maximum of 2.** Options: boolean plus tags, free text ratings, three steps. Why: precise limits per profile at low cost, one predicate. Reversible: partly (data is additive, labels are config).
- **L5-D5 `kids_safe` stays and is derived from rank by trigger; `suitability` becomes read only and is dropped one release later.** Options: remove `kids_safe` now, dual write in services. Why: zero change for every existing query and the kids lock, safe rollback. Reversible: yes.
- **L5-D6 Backfill: kids safe to 0, `older` to 3, everything else to 2; unrated counts as 4 for limited profiles (fail closed).** Why: conservative for children, editor can bulk correct. Reversible: yes.
- **L5-D7 Raising a profile limit needs the account password, lowering does not.** Why: same pattern as leaving kids mode, prevents a child raising it. Reversible: yes.
- **L5-D8 Trending is a stored hourly snapshot, 7 Lagos days, 0.8 daily decay, one viewer capped at 3 plays a day, minimum 10 plays per title, 5 qualifying titles and 50 site plays to show, hidden (never relabelled) below that.** Options: compute per request, daily rollup only, relabel as popular. Why: cheap reads, resistant to one person replaying, honest on a new site. Reversible: yes (all values are settings).
- **L5-D9 Popular uses 30 days from daily stats with series included; below threshold it falls back to newest only when the editor opts in, under a different title.** Why: no misleading labels. Reversible: yes.
- **L5-D10 Top 10 is optional, default off, needs 10 qualifying titles for the profile, ranks after filtering.** Reversible: yes.
- **L5-D11 Notices are per profile, never created for kids, fanout by worker polling `videos.announced_at` instead of hooking publishing.** Options: hook `publish()` and the scheduler, an events table. Why: no edits in the publishing code other lanes touch, idempotent by dedupe key, launch backfill prevents a flood. Reversible: yes.
- **L5-D12 New video notices are grouped one per profile per day; new episode notices one per series per profile per run.** Why: prevents noise on bulk publish. Reversible: yes.
- **L5-D13 Viewer email digest is opt in, off by default, account level, generic content from non-kids profiles, limited by the primary profile limit, with one click unsubscribe, sent through the existing outbox.** Options: on by default, per profile email. Why: consent under the NDPA, no household leaks. Reversible: yes.
- **L5-D14 Web push is Could, generic payload without titles, subscribe only on explicit press, refused under a kids profile.** Why: locked screen exposure and child safety. Reversible: yes.
- **L5-D15 Notices kept 60 days and at most 100 per profile.** Why: data minimisation (SECURITY.md section 10). Reversible: yes.
- **L5-D16 Guest intent contract: one pending intent in `sessionStorage` for 15 minutes, replayed through the normal API after sign in, never stored server side.** Why: no guest data at rest, works with L1's dialog. Reversible: yes.
- **L5-D17 My List filter and sort run in the query with cursors, state lives in the URL.** Why: correct pagination, shareable and back button safe. Reversible: yes.
- **L5-D18 My List cap stays 500 (code), the data model doc is corrected from 200.** Why: the code and rules are the truth. Reversible: yes.
- **L5-D19 Continue Watching uses a kebab menu instead of a permanent close button.** Why: avoids accidental removal, matches DESIGN-SYSTEM 11.5. Reversible: yes.

## 10. Mockups S120 to S129 (HTML in `/home/claude/ad/project/`, same naming as the existing set, `.dc.html`, mobile files end `_m`)

Each mockup shows the states listed, built from tokens only, with the default theme and one extreme theme (dark ink on lemon, size factor 1.15) as a second frame where text is dense.

| No. | File names | Content and states |
|---|---|---|
| S120 | `S120_title_rating.dc.html` and `S120_title_rating_m.dc.html` | Title page (video and series) with rating group, maturity badge, Most liked label. States: none selected, Like, Love, Not for me, saving (disabled, 3 s max), error toast, guest tapped (dialog from L1 with the rating reason), title unavailable, kids profile (group absent). Mobile 360 px with the two row action layout. |
| S121 | `S121_rating_guest_dialog_m.dc.html` | Sign in to save dialog for a rating, desktop and mobile frames, and the return toast "Saved to your profile". Reconciled with L1's dialog mockup. |
| S122 | `S122_card_hover_actions.dc.html` | Desktop card default, hover, keyboard focus, rated, Most liked, G versus 15 chip, My List plus rating chip expanded, reduced motion note. First and last card origin. |
| S123 | `S123_home_trending.dc.html` and `S123_home_trending_m.dc.html` | Home with Trending now, Top 10 (numbered tiles, 1280 and 360 px with peeking next tile), Most liked row. States: normal, cold start (rows absent, Newly added fallback), row error with retry, skeleton rows with numeral space reserved, kids Home. |
| S124 | `S124_notification_bell.dc.html` and `S124_notifications_m.dc.html` | Bell with badge (0, 3, 9+), desktop popover list (unread, read, empty, error), mobile `/notifications` page, mark all as read, new episode and new videos items, Data saver note, kids profile with no bell. |
| S125 | `S125_notification_settings.dc.html` and `S125_notification_settings_m.dc.html` | `/account/notifications`: switches, email Off Daily Weekly, consent line, masked address, push button supported and unsupported, saved and error states. |
| S126 | `S126_profile_maturity.dc.html` and `S126_profile_maturity_m.dc.html` | Edit profile with "Allow titles rated up to", password step for raising, wrong password, kids profile fixed state, manage profiles tile showing the limit label, forced colours frame for the tile focus ring. |
| S127 | `S127_admin_maturity_ratings.dc.html` and `S127_admin_maturity_ratings_m.dc.html` | Admin video edit Maturity rating select, publish dialog blocked state, bulk apply with failure list, series apply to episodes confirm, analytics Top titles with rating columns and "Under 10 ratings", per video ratings tile. |
| S128 | `S128_my_list_filters.dc.html` and `S128_my_list_filters_m.dc.html` | My List with pills (counts), sort select, results, empty per filter, skeleton on change, offline "Showing saved list", hidden items note, 360 px horizontal pill scroll. |
| S129 | `S129_continue_watching.dc.html` and `S129_continue_watching_m.dc.html` | Continue Watching row: episode label, Next: E4 badge, time left, kebab menu open (Remove from row, Go to title page), Undo toast, keyboard focus, kids profile, empty and error row. |

Total: 10 mockup numbers, 18 files (S121 is a single combined file).

## 11. Risks and dependencies

1. **Widening `Audience`.** A caller that builds its own `{ kids }` object skips the rank filter. Mitigation: `audienceOf` is the only constructor in viewer code (grep in slice 1), a lint style test in `packages/catalog` fails if a route builds an `Audience` literal outside `audienceOf` and the guest helper, plus the route matrix test of slice 2.
2. **Backfill rating accuracy.** Rating everything not kids as 12 may hide older titles from profiles limited to PG that the owner meant to allow, or show borderline content to 12. Mitigation: only affects profiles the parent limits; admin bulk correct; the verification query lists counts per rank; owner question 1.
3. **`ALTER TYPE ... ADD VALUE`** cannot be used in the same transaction as the new value. The migration only adds, the first use is in code. The integration test DB setup runs migrations in order, so check it runs this statement outside a transaction block (drizzle breakpoint). If not, split into 0038a.
4. **Worker privileges.** `ad_worker` must read `view_events` for the snapshot and must not read `title_ratings` rows. Tested with role specific integration tests; the aggregate function is `SECURITY DEFINER` with a fixed `search_path`.
5. **Snapshot cost.** Hourly scan of seven days of `view_events`. At launch scale (about 1,200 plays a day) this is trivial. At 100x it still uses `view_events_started_idx`. Revisit only if a run exceeds 30 seconds (the System page shows duration).
6. **Cache fan out.** Cache keys vary by audience tier: five tiers times three row kinds is 15 entries per minute. Acceptable.
7. **Email deliverability and consent.** Digest needs SPF, DKIM and DMARC (M21-S04) before it is switched on; default off protects launch. Legal text for the privacy page (M26) must mention ratings and notices: client content item.
8. **Household privacy.** Notices per profile reveal interests to whoever opens that profile. Same as Continue Watching today; PIN protected profiles (M03-S12) cover it. Email stays generic.
9. **Web push** needs VAPID keys and a library; kept Could and hidden when unset. iOS needs the PWA installed (M25-S01) for push, document in the settings help text.
10. **Rating gaming.** A rating needs an account and a profile; guests cannot rate. A bot with many accounts could still skew a small catalog. Mitigations: `engage` rate bucket, minimum raters, account creation limits already in M01. Not solved fully, accepted at this scale.
11. **Dependency on L1.** The `Viewer` union and dialog. Slice 4 ships behind the local stub and the contract in 4.3, switching to L1's hook is a one file change. If L1 slips, guests simply get the existing sign in redirect for rating.
12. **Merge conflicts** on shared files listed in the merge plan. `packages/shared/src/enums.ts` and `definitions.ts` are small append only changes.
13. **Doc drift.** Audit lists mismatches (D-number duplicates, BUILD-PLAN lane table). Out of scope here except the My List cap line (L5-D18).
14. **Time budget.** Slices 1 to 8 and 10 and 11 cover every Must and Should story. Slice 9 (push), M44-S09 (Top 10) are Could and can slip without blocking launch.

## 12. Owner questions (genuine, need Sister Vanessa or the owner)

1. **Maturity labels.** Keep the Nigerian style G, PG, 12, 15, 18, or prefer plain words (All ages, 7+, 13+, 16+, 18+)? Default is built either way and changeable in site settings. Needs client confirmation before launch (listed for `docs/CLIENT-INPUTS.md`).
2. **Anonymous visitors and mature content.** Recommended default: guests see up to rating 12 (setting `maturity.guestMaxRank`). Confirm that the owner wants adult rated (15 and 18) titles hidden from people who have not signed in.
3. **Will the platform host any 15 or 18 content at all?** If the answer is no, the ladder can stay but the editor UI could show only G, PG and 12 to reduce confusion.

No other open questions: every remaining choice has a recommended option logged in section 9.
