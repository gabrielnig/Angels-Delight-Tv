# Admin knowledge base recording spike

Status: works on this sandbox. Captioned screen recordings of the real admin screens, desktop 1280x720 and mobile 390x844, are produced by one command from the fixture build, with a visible cursor, click ripple, eased scrolling, burned in captions, a separate .vtt, and numbered annotated screenshots with automatic email redaction.

The plan for the knowledge base itself is written elsewhere. This note only proves the recording step and recommends a pipeline.

## What exists in the repo

- Playwright config `apps/web/playwright.config.ts` (projects mobile 360x740 and desktop). `E2E_CHROMIUM_PATH` overrides the browser. Specs in `apps/web/e2e/*.e2e.ts`. Fixture sign in is already used by `admin-l3-layout.e2e.ts`.
- Fixture build: `scripts/ci-fixture-env.sh` prints a throwaway env (no database, no real secrets). Admin data is in memory (`ADMIN_DATA=fixture`), the demo owner is `chiamaka@example.test` with password `fixture-password`, the 6 digit code is `123456` (the screen says so in the fixture build, `DEV_SKIP_MFA=true`).
- Real services mode with a seeded Postgres is documented in `docs/DEV-SETUP.md` (`pnpm db:seed:demo`, `scripts/e2e-video-up.sh`). Not used here, see the dataset section.

## Browser and tooling check on this sandbox

| Item | Result |
| --- | --- |
| Chromium | Preinstalled in `/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH` is set, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`). Playwright 1.65.1 finds it with no install. Chrome for Testing 153. |
| `pnpm exec playwright install chromium` | Does nothing here because of the skip flag. With the flag unset and `PLAYWRIGHT_BROWSERS_PATH=/tmp/pwb` the download of the headless shell (125 MiB) succeeded through the proxy, so the allowlist does not block it. Nothing is blocked. |
| ffmpeg | 6.1.1 at `/usr/local/bin/ffmpeg` with `libass` (`ass` and `subtitles` filters) and `drawtext`. ffprobe present. |
| Fonts | Inter is installed system wide, used for captions and annotations. |
| Machine | 2 CPUs, 8 GB. Fine, but x264 encoding of 1280x720 is the slowest step. |

## Exact commands

From a fresh worktree after `pnpm install`:

```bash
# 1. Fixture environment, once. Throwaway keys, no real secrets. Port 3113.
scripts/ci-fixture-env.sh 3113 > /tmp/kb.env

# 2. Boot the web app on the fixture data.
(cd apps/web && set -a && . /tmp/kb.env && set +a && pnpm exec next dev -p 3113)
curl -s localhost:3113/api/health        # wait for 200

# 3. Record the sample episode, both viewports. Output goes to .kb-out (git ignored).
pnpm kb:record --episode home-preview --profile desktop,mobile --out .kb-out --run run1

# 4. Compare two runs (duration, frame pacing, cue drift, SSIM).
pnpm kb:record --episode home-preview --out .kb-out --run run2
scripts/kb-recorder/measure.sh .kb-out run1 run2 home-preview desktop

# Scoped tests for the pure helpers.
pnpm vitest run scripts/kb-recorder
```

Options: `--base-url` (or `KB_BASE_URL`), `--pace 1.5` (slower), `--no-warm` (skip the silent warm up pass, use against `next start`), `E2E_CHROMIUM_PATH` for another browser.

Outputs per episode and profile in `.kb-out/<run>/<episode>/<profile>/`:

- `<episode>-<profile>.mp4` H.264, 30 fps, captions burned in
- `<episode>-<profile>.vtt` the same captions as a separate file (also `.ass`, the burn source)
- `<episode>-<profile>.raw.webm` clean capture with no captions, so captions can be re burned or translated
- `shots/NN-name.png` numbered annotated screenshots, `meta.json` timings

Samples from this run are copied to `/home/claude/kb-samples/` (desktop and mobile mp4 and vtt, three screenshots).

## How it works

- `record.ts` runs an episode twice: a silent warm up pass (Next dev compiles each route on first visit, which would show as blank frames), then the recorded pass with Playwright `recordVideo` at exactly the viewport size.
- `overlay.ts` is injected into every page: cursor arrow (touch circle on mobile), ripple on mouse down, amber highlight box, eased cursor glides and eased scrolling run inside the page with `requestAnimationFrame`, a mask for the Next dev badge, and an email redactor (MutationObserver, keeps `example.com`, `.net`, `.org`, `.test`, `.invalid`, hides everything else).
- `session.ts` gives episodes slow deliberate actions: `click`, `type`, `point`, `reveal`, `shot`. It only scrolls when the target is not comfortably on screen, so pages do not jump.
- Caption timing is measured, not guessed: each step records its start and end on the video clock, `buildCues` turns that into cues with a quarter second lead, and the runner pads a step to the reading time of its caption (2 s floor, 55 ms per character). So a caption always matches the action it describes, even when the app is slow.
- `burn.ts` re encodes the webm to 30 fps mp4 and burns an ASS file generated from the cues. ASS is used instead of SRT styling because it sizes text in real pixels (PlayRes equals the video) and takes margins. Desktop: 34 px, side margins 96 px, bottom 44 px. Mobile: 22 px, side margins 24 px, bottom 64 px (clear of the phone home bar). White bold Inter on a 90 percent black box.
- Annotated screenshots are drawn as an SVG layer in the page before `page.screenshot`, using the pure geometry in `annotate.ts` (badge on the corner of the target, clamped inside the viewport, arrow to the nearest side). No image library was needed. Emails are redacted first, including input values.

## Measurements (this sandbox, two runs of the same script)

| | Desktop 1280x720 | Mobile 390x844 |
| --- | --- | --- |
| Video length | 35.2 to 35.6 s | 35.4 to 35.8 s |
| Final mp4 size | 0.9 to 1.0 MB | 0.9 MB |
| Raw webm size | about 2.6 MB | about 1.9 MB |
| ffprobe | h264, yuv420p, 30 fps, plays, duration matches the episode clock | same |
| Raw capture pacing | constant 25 fps, every gap 40 ms, no gap over 80 ms | same |
| Wall time per profile | warm up about 10 to 13 s, recording about 36 s, burn 8 to 13 s (desktop), 5 s (mobile) | |
| Run to run cue drift | up to 0.7 s on later cues (network idle waits and fixture compile time vary) | up to 0.6 s |
| Run to run SSIM at fixed times | 0.989 to 0.999, one frame 0.957 at a moment when a transition was in flight | 0.958 to 0.998, one frame 0.59 mid transition |

Reading: the visual result is stable (same layout, same data, same captions). Timings drift by a fraction of a second, which is fine because captions are generated from the measured timings of each run, so they never go out of sync. Do not expect byte identical files.

## What worked

- Everything in the goal list on this machine, with no installs. Sign in with typing, 2FA digits, mobile menu, Videos list, video editor, Home preview clip card, all on the real components.
- Cursor and ripple are clearly visible in both sizes. Captions are readable on dark and light screens.
- Pure helpers have tests: caption parsing and writing (VTT and SRT, ASS), cue building, reading time, email redaction, annotation geometry (30 tests, `pnpm vitest run scripts/kb-recorder`).

## What did not work, limits and gotchas

- The app sends a strict `style-src` CSP with a nonce, which blocked the overlay's inline styles (cursor was invisible in the first take). The recorder uses `bypassCSP: true`. Recording only, never against production.
- A function passed to `page.evaluate` that declares a nested named arrow gets a `__name` helper from tsx and throws in the page. Browser code that needs helpers lives as plain text in `overlay.ts`.
- Burned in captions cover the bottom 100 px or so. A target near the bottom edge can sit under a caption. Fix when needed: per cue top alignment (ASS `\an8`), or scroll the target higher (`reveal(target, 0.2)`).
- The amber highlight is fixed to the screen, so on a client side navigation it can linger for under a second over the new page (seen once on mobile after Verify). Harmless, can be cleared on navigation later.
- Playwright `recordVideo` is 25 fps VP9 at fixed quality. It is smooth enough for UI, but fast animation is not buttery. A CDP screencast with ffmpeg would give 30 fps or more but is more code and not needed.
- The video clock starts at page creation and the step clock is set just after, so cues can be a few tens of milliseconds early. Not visible in the samples. Measure again if cues ever feel early.
- Fixture admin state is in memory. An episode that saves something changes the data for the next run. Restart the server between runs of such episodes, or keep episodes read only (the sample is).
- Next dev serves slow first loads, so the warm up pass doubles run time. Against `next build && next start` use `--no-warm`.
- Mobile uses `isMobile` with a mouse, not real touch. The cursor is drawn as a touch circle. Good enough for how-tos.
- The real services mode (Postgres) was not recorded in this spike. It should work the same way because the episode only uses roles, labels and links, but the sign in screen differs (real 2FA code), so episodes need a small sign in helper for that mode.

## Demo dataset recommendations

- Record from the fixture build or from a database seeded only with fake data. Never record from a real or staging copy of client data.
- Owner and staff: `demo.owner@example.com`, `demo.editor@example.com`, display names clearly fake ("Demo Owner", "Demo Editor"). Use only the reserved domains `example.com`, `example.net`, `example.org`, `example.test` (the redactor keeps those and hides anything else, so a leak shows as `[email hidden]` in the video).
- Fixed catalog: 10 to 12 videos with plain titles ("Staying Safe Online", "Rivers of Africa"), one per status (Published, Scheduled, Ready, Needs captions, Processing, Draft, Failed) so every screen has something to point at, 2 series, 5 categories, a few notifications. The fixture build already has this.
- Fixed clock: seeded timestamps relative to a fixed date, so labels like "Failed 31 minutes ago" do not change the picture between runs. The app clock should be pinned for recordings (the fixture dashboard shows relative times, which is the main source of visual diff between runs).
- No client logo, real names, phone numbers or real thumbnails in the demo data.

## Where recorded files should live

- Not in git. One episode is about 1 MB as mp4 (desktop and mobile), and 2 to 3 MB for the raw webm. Fifty episodes in two sizes, with the raw files, would add up to about 250 MB and every re record adds the full amount again to history.
- Keep in git: the episode scripts, the generated `.vtt` captions (a few hundred bytes), and the tooling. Those are the sources.
- Store the mp4, raw webm and screenshots as a CI artifact per run, and publish the mp4 and vtt to the media bucket (`BUCKET_MEDIA`, a `kb/` prefix) or to the Angels Delight TV player itself for the help centre. Git LFS is a fallback only if the owner wants the files in the repo, because the free tier is small.

## Recommended production pipeline

1. Script format per episode: keep the TypeScript episode module (`scripts/kb-recorder/episodes/<id>.ts`), one default export `{ id, title, steps[] }`, each step `{ caption, run, shot? }`. It is typed, reviewed in a PR and it fails to compile when a helper changes. Add front matter fields `locale`, `viewports` and `requires` (role needed) when the plan needs them. A step stays one sentence of caption, one action. Translated captions can come later from a `captions.<locale>.json` map keyed by step number, burned from the raw webm without re recording.
2. Runner command: `pnpm kb:record --episode <id> --profile desktop,mobile --out .kb-out`, and a small `--all` flag (not built yet) that loops over `episodes/` once there is more than one.
3. CI check ideas, in order of cost:
   - Cheap, every PR: `pnpm vitest run scripts/kb-recorder` plus a lint that every episode caption passes the footprint rules and has at most 90 characters.
   - Per PR that touches `apps/web/src/components/admin` or `app/admin`: run the episodes with `--pace 0.2 --no-warm` and no video (the session and locators are the test). A failing locator means an admin screen changed and the how to is out of date. This is the real value of the pipeline.
   - Nightly or on release: full recording on a GitHub Actions `ubuntu-latest` runner against `next build && next start` with the fixture env (`scripts/ci-fixture-env.sh`), upload `.kb-out` as an artifact, run `ffprobe` to assert duration is within 10 percent of the last run and size is under 5 MB per file.
4. Review step: a human watches each new or changed video once (35 seconds) before it is published. Recording is cheap, so re record on every release that touches the screens rather than patching videos.
5. Publishing: upload the mp4 and vtt, link them from the knowledge base article. Show the `.vtt` as a caption track in the player so viewers can switch captions off, and also keep the burned captions for silent autoplay.

No GitHub Actions workflow was added, because the browser runs here. Add the nightly job above when the plan decides to publish videos.
