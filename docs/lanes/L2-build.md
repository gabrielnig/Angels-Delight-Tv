# Lane L2 build notes (module M41, Home hero, rows and sections)

Plan `docs/plan/v2/L2-home.md`, review `docs/reviews/v2/L2-review.md`, rulings `docs/plan/v2/RULINGS.md`. Worktree `/home/claude/wt2/L2b-build` (L2b continues from slice 6b), branch per slice `l2/sN-...`.

## Slices

| # | Slice | State | PR |
|---|---|---|---|
| 1 | Hero artwork and five newest fallback | merged (restored by 288 after two other lanes reverted it) | 281, 288 |
| 2 | Home settings, Home tab, rules | merged | 289 |
| 3 | Hero carousel rewrite, scrim measured | merged | 299 |
| 4 | Row View all, snap, gap compensation, skeleton height | merged | 302 |
| 5 | Row link and preview migrations, row resolution | merged | 322 |
| 6 | Browse list pages (new, trending, series, row/[slug]) | merged | 329 |
| 6b | List page loading skeleton, 5 and 6 across grid | merged | 333 |
| 7 | Admin sections editor | merged | 341 |
| 8 | Launch default rows and the apply tool | merged | 345 |
| 9 | Preview clip schema, queue and worker job | merged | 351 |
| 10 | Admin hero slots: preview mode, slide text | merged | 357 |
| 11 | Viewer preview delivery, slide text, live admin preview | merged | 367 |
| 12 | Hover card (portal, 300 ms, mouse only) | this PR | |

## Exists

- Hero: `packages/ui/src/components/useHeroTimer.ts` (clock), `Hero.tsx` (`intervalMs`, `maxLoops`), `apps/web/src/components/home/hero-items.ts`, `HomeHero.tsx` takes `rotate`, `intervalSeconds`, `maxLoops` from settings read in `HomeView`.
- `packages/catalog/src/rows.ts` `heroCards(..., fallbackCount)`; `ViewerRules` home fields.
- Settings group `home` (Home tab in Site settings).
- Chromium text zone test: `packages/ui/test/hero-text-zone.test.ts` (skips without Chromium, `HERO_DEBUG=1` prints geometry).
- Row: `viewAllHref`, `viewAllLabel`, `viewAllExternal` (`seeAllHref` is a deprecated alias).

## Scoped tests

`pnpm vitest run packages/ui` (package only), `packages/catalog/src/rows.hero.int.test.ts`, `packages/viewer/src/home.int.test.ts` (need `TEST_DATABASE_ADMIN_URL`).

## Heads up

- Commits 71b5d54 and 5df08b4 (other lanes) silently reverted slice 1 files. Check `git diff origin/main` of your own files before relying on them.
- The mobile hero scrim differs from R36 stops on purpose (D in DECISIONS, measured).

## Slice 7 notes

- Admin Home screen is split: `HomeCuration.tsx` (toolbar, hero titles, preview, add dialog), `HomeSections.tsx` (list, rename in place, drag and keyboard reorder, live region), `SectionEditor.tsx` (name, View all, minimum, Kids, removal), `ViewAllField.tsx`, `ManualTitles.tsx`.
- `apps/web/src/lib/data/admin/home-clean.ts` rebuilds the config on save and now keeps `slug`, `viewAllMode`, `viewAllUrl`, `minItems`, `kidsVisible` (the old inline copy dropped them).
- Helpers in `home-rules.ts`: `viewAllSummary`, `viewAllOpens`, `duplicateNameNote`, `ADD_TYPE_LABELS`, `ADD_TYPE_HINTS`.
- Tabs Hero slots and Sections, and Restore launch defaults from S97 arrive with slices 8 and 10.

## Slice 8 notes

- `packages/catalog/src/admin/home.ts`: `LAUNCH_HOME_SECTIONS`, `launchHomeConfig(titles)`, `hasPublishedHome(ctx, actor)`. `defaultHomeConfig` now puts My List second and names the first row Continue learning (F14, R14).
- `packages/launch/src/apply.ts`: step `home` through `ApplyDeps.home` (`HomeSeeder`), wired in `cli/apply.ts`. `client.json` block `home` (`seedDefaults`, `continueTitle`, `newTitle`, `trendingTitle`); `continueTitle` also writes setting `home.continue_title`.
- Admin screen: Restore launch defaults button (toolbar and empty state) puts the launch set in the draft with a confirm, nothing is saved until the editor saves. Web copy in `home-rules.ts` `launchHome`, kept equal by `home-parity.test.ts`.
- Viewer fallback title for the personal row is now Continue learning.

## Slice 9 notes

- Migration `0050_video_previews.sql` (columns `preview_*` on `videos`, checks, partial index `videos_preview_sweep`), schema in `packages/db/src/schema/content.ts`.
- `packages/video/src/preview.ts` (pure: `planPreview`, `previewArgs`, `previewKey`, constants), `preview-sweep.ts` (`sweepPreviews`), `VideoPipeline.previewClip`, `queuePreview`, `sweepPreviews`. The clip job never fails the video; it records `skipped` or `failed` with a plain note.
- Queues `video.preview` and `video.preview_sweep` (hourly at :20 Lagos, `PREVIEW_CRON_SCHEDULES`), registered by `apps/worker/src/preview-handlers.ts`, wired in `main.ts`.
- Thumbnails success queues a clip (state `queued`) unless the mode is `off`. Failed encode cleanup removes the clip. Purge already removes `cap/{prefix}/`.
- Scoped tests: `packages/video/src/preview.test.ts`, `packages/video/src/encode/preview.int.test.ts` (needs ffmpeg and `TEST_DATABASE_ADMIN_URL`), `packages/video/src/preview-sweep.int.test.ts`, `packages/db/src/video-previews.int.test.ts`, `apps/worker/src/preview-handlers.test.ts`.
- The `cap/` prefix is public and unsigned (sprites use it the same way), so slice 11 can use `${origin}/${previewKey}` without signing.

## Slice 10 notes

- Preview mode and retry: `packages/catalog/src/admin/preview-clip.ts` (`setAdminPreviewMode`, `recutAdminPreview`), `PreviewClipCard` in the admin video editor, fixture twins in `video-commands.ts`.
- Hero slide text: `HomeConfig.heroText` (keyed by video id, 80 characters each) in both the catalog and web copies. Stored on the hero row items as `hero_headline`, `hero_blurb`, `hero_button_label`. `HeroSlots.tsx` edits it. The viewer does not read it yet (slice 11).
- Text is kept as typed in the editor and trimmed on save.

## Slice 11 notes

- Catalog `heroSlideExtras` (rows.ts) returns editor text and `previewUrl`, `previewMs` per hero card (ready and mode not off, a series uses its first episode). Viewer `HeroItem` carries `text`, `previewUrl`, `previewMs`; web `HeroSlot` carries `headline`, `blurb`, `buttonLabel`, `previewUrl`.
- Eligibility is `apps/web/src/lib/lowdata/hero-preview.ts` (fast link and downlink 5 Mbps or more, Data saver off, no reduced motion, tab visible, unknown connection only when `home.hero_previews_unknown_connection`). `HomeHero` re-decides on connection, motion and visibility changes. `Hero` takes `previewAllowed`; `HeroPreview` mounts one video for the active slide only, source after 1.2 s, removed on error or a 2 s stall, hidden under reduced motion.
- Admin live preview lists every slide with headline, button and a clip badge, plus each section View all line.

## Slice 12 notes

- `packages/ui/src/components/HoverCard.tsx`: `useHoverCard` (300 ms rest, 100 ms grace, mouse and fine pointer only, one open at a time, Escape, closes on scroll and resize, origin from the row edges) and `HoverCard` (portal in the body, role dialog, scale 1.25 inline, none under reduced motion).
- `VideoCard` renders the card on hover with the thumbnail, Play link (`playHref`), My List toggle, rating chip, More info, length, subject, maturity chip, Most liked and a two line description. The inline `.ad-card__peek` and the thumbnail scale CSS are removed. Series and Continue cards have no hover card (they had no peek).
- `--row-pad-block` (room for the old scale) is left in place so row heights do not move; it can be dropped in a later tidy.
- `packages/ui/test/focus-ring.test.ts` fails on main for `.ad-bell__popover:focus` (not this lane).
