# Lane L2: Home hero, rows and sections (M41)

Status: built. Plan: `docs/plan/v2/L2-home.md`. Rulings: R10 to R14, R30, R37, R39. Build log with PR numbers: `docs/lanes/L2-build.md`. Stories: M41-S01 to M41-S22. Decisions: D-351 to D-355, D-366 to D-368 (hero clip upgrade, below), D-274, D-275, D-282, D-288 to D-291, D-298, D-303, D-306, D-312, D-338 to D-344.

## What it owns

- Viewer: the hero carousel (`packages/ui/src/components/Hero.tsx`, `useHeroTimer.ts`, `hero-timing.ts`, `hero-sound.ts`, `HeroPreview.tsx`, `apps/web/src/components/home`), rows with View all, the list pages under `/browse` (`new`, `trending`, `series`, `row/[slug]`), the hover card (`HoverCard.tsx`), skeletons and states.
- Admin: Home curation (`apps/web/src/components/admin/HomeCuration.tsx`, `HomeSections.tsx`, `SectionEditor.tsx`, `ViewAllField.tsx`, `HeroSlots.tsx`), the video editor preview card (`PreviewClipCard.tsx`).
- Backend: `packages/catalog/src/rows.ts` (`heroCards`, `heroSlideExtras`), `packages/catalog/src/admin/home.ts` and `preview-clip.ts`, `packages/viewer/src/home.ts`, the worker clip job (`packages/video/src/preview.ts`, `apps/worker/src/preview-handlers.ts`), the apply tool home step (`packages/launch/src/apply.ts`).
- Data: migrations 0045, 0046 and 0050 (see DATA-MODEL).

## Rules to keep

- Two admin implementations (fixtures in `apps/web/src/lib/data/admin`, real in `packages/catalog/src/admin`) stay in step. `home-parity.test.ts` fails when they drift.
- The hero clip never loads unless `heroPreviewEligible` says so. The clip starts muted and autoplays muted; sound is only ever turned on by the viewer's own click (see the sound button below). Nothing in a row plays video.
- The hover card opens for a mouse only. Touch and keyboard focus keep the card actions.
- Every default label, interval and switch is a site setting, not a constant. Nothing here needs client input.

## Scoped tests

`pnpm vitest run packages/ui/src/components/Hero.test.tsx packages/ui/src/components/HeroPreview.test.tsx packages/ui/src/components/HoverCard.test.tsx packages/ui/src/components/Hero.clip.test.tsx packages/ui/src/components/Hero.sound.test.tsx packages/ui/src/components/hero-timing.test.ts packages/ui/src/components/hero-sound.test.ts packages/ui/src/hero-controls-css.test.ts apps/web/src/components/home apps/web/src/components/admin/HomeCuration.test.tsx apps/web/src/lib/data/admin/home-parity.test.ts`. Integration (need `TEST_DATABASE_ADMIN_URL`): `packages/catalog/src/rows.hero.int.test.ts`, `packages/catalog/src/admin/home.int.test.ts`, `packages/viewer/src/home.int.test.ts`, `packages/video/src/encode/preview.int.test.ts`.

## Why no clip played on the live site (diagnosis of tag 6835b9bc)

A viewer sees a clip only when all of these hold. The first four are server side, the rest are in the browser.

1. The video is published and ready and has its original file. Videos published before the preview feature exist have state `none`. The hourly sweep (`video.preview_sweep`, at :20 Lagos time) did cover them, but only 10 an hour and only state `none`, so a failed, skipped or still queued video was never retried and the owner had no screen that showed any of this.
2. The clip job made a file: the video editor card Home preview clip shows the state. `Skipped` with "too dark or plain" means the best frame scored low, `Failed` means ffmpeg or storage failed, `Skipped` with "original file is no longer stored" means the original was deleted.
3. The video's mode is not Off.
4. The Home data carries the clip only when state is `ready` and the mode is not Off (`heroSlideExtras`).
5. Site setting Hero preview clips is on (it was on by default).
6. In the browser the connection test passed. This is what most likely hid the clip on the live site even when clips existed: the floor was a reported downlink of 5 Mbps (Chrome reports well under that on most Lagos connections) and Safari and Firefox, which do not report speed, were excluded because `home.hero_previews_unknown_connection` was off by default. Data saver on, reduced motion on, a hidden tab, or a 2g or 3g connection type also stop it.
7. The slide only waited 10 seconds and the clip was 6 seconds, starting 1.2 seconds after the slide showed, so even a working clip was short.

What this change does about it: the speed floor is a setting (default 2 Mbps), unknown connections are on by default, the clip is 20 seconds (setting), the slide waits for the clip, and the button Generate previews for all videos on `/admin/home` queues every video that has no current clip.

### Owner steps after deploy

1. Sign in as an admin and open Admin, Site settings, Home. Check Hero preview clips is on, Preview clips on unknown connections is on (Super admin only), Seconds per hero slide is 20, Seconds per hero clip is 20, Slide waits for its clip is on, Sound button on hero clips is on. If the clip still does not play on a slow connection, lower Slowest link that plays clips to 1.
2. Open Admin, Home curation. In the Hero clips card press Generate previews for all videos. It reports how many videos were queued. The worker cuts one clip about every minute.
3. Open one video (Admin, Videos, the video) and look at the Home preview clip card: state Ready means the clip exists, Queued means wait, Failed or Skipped shows the reason and Retry. A video you set to Off never gets a clip.
4. Make sure the video is a hero slide: Home curation, Hero slots, or leave it empty and the five newest titles are used.
5. Open the Home page in a normal (not private, Data saver off) window on a phone or computer with the device motion setting "reduce motion" off. The clip starts after about a second, muted, and there is a Unmute button beside Pause when the clip has sound. The slide changes when the clip ends.
6. After changing Seconds per hero clip, press Generate previews for all videos again so existing clips are cut to the new length.

## Known gaps

- Stories M41-S18 (upload your own clip) and M41-S19 (a viewer setting for previews) are Could items and are not built.
- `--row-pad-block` still reserves room for the old thumbnail scale and can be dropped in a tidy.
- Mockups S90 to S99 were not authored; the design system skill was used as the reviewer.
