# L14 build: admin knowledge base (M50)

This file has two parts. The platform part (articles, help pages, search) is written by lane KB-P. The harness part below is written by lane KB-H and tells content lanes how to write episodes and run the recording tools. Both lanes append to their own part only.

## Platform (lane KB-P)

Worktree `/home/claude/wt2/KBP-build`. Builds the help centre itself: the content format, loader, pages, player, media route, panel, search, progress and the coverage tests. Content lanes write articles into `content/help`, the harness lane (KB-H) records the videos and screenshots.

### Slice status

Platform status: complete except the offline handbook ZIP and whole handbook PDFs (release tooling, plan L14-11) and wiring `InlineHint` to real settings forms once the content lanes publish the guides it points at. Design system review done (one finding fixed), production build passes.

| Slice | Contents | State |
|---|---|---|
| 1 Content format | `@ad/help` (schema, parser, library, lint, glossary, route matching), `content/help`, `pnpm help:check`, 3 sample articles, stories and decisions | Merged in the first platform PR |
| 2 Pages | `/admin/help` home, path, article with contents list, role labels, print layout, Help in the side menu, top bar and page header, route to article map, private picture route, `help.support_contact` setting, coverage tests with `content/help/coverage-gaps.json` | Merged in the second platform PR |
| 3 Progress | migration 0060 `help_progress` (RLS, purge, export), service with fixture and real versions, Mark as done, Was this helpful, progress card | Merged in the third platform PR |
| 4 Video | private media route with Range for pictures, videos and captions, `HelpVideo` player with captions track, quality and picture choice, transcript, watched at 90 percent, `/admin/help/videos/[id]` with playlist, isolation test | Merged in the fourth platform PR |
| 5 Panel | `HelpPanelHost` and `HelpPanel` (drawer from 60rem, bottom sheet below), top bar Help button opens it (a real link without script), question mark key, focus trap, Escape, swipe, return focus, loading, slow, offline, error and no guide states, `InlineHint`, `panelFor` and `helpPanelAction`, D-384 | Merged (PR 435) |
| 6 Search and glossary | pure scorer in `@ad/help` (`search.ts`: stemming, aliases, one edit typo tolerance, Did you mean, role ordering, highlights), `/admin/help/search`, `/admin/help/glossary` (A to Z jump, filter, anchors by slug, guide links), search box on the help home with the slash key. Recent searches are not stored, so no storage key was added | Merged in the fifth platform PR |
| 8 Print and PDF | Download PDF with print fallback, `/admin/help/media/pdf/<ID>.pdf`, printed guide ids, measured print layout, D-387. Offline handbook ZIP is release tooling (plan L14-11), not built here | Merged (PR 439) |
| 7 States and checks | `HelpStates` (error, not found, loading, connection note), offline and playback states in `HelpVideo`, `useSaveQueue` retrying saves with a quiet toast, `apps/web/e2e/admin-help.e2e.ts`, D-386 | Merged (PR 437), docs done |

Update this table in every platform PR.

### Content format spec (content lanes must follow this exactly)

Run `pnpm help:check` before every commit that touches `content/help`. It fails with the file name and the reason. `pnpm vitest run packages/help/src/node.test.ts` runs the same checks.

#### Files and folders

- Articles: `content/help/en/<path>/<ID>-<slug>.md`. `<path>` is one of `start`, `daily`, `weekly`, `setup`, `money`, `safety`, `troubleshooting`, `reference`. The first letter of the id says the path: S start, D daily, W weekly, C setup, M money, K safety, T troubleshooting, R reference. The id is the letter and two digits (`D02`). The slug is lower case words joined by hyphens. Ids are never reused or renumbered.
- Glossary: `content/help/en/glossary.md` (format below).
- Pictures: `content/help/media/<ID>/<file>.webp`, written in articles as `../../media/<ID>/<file>.webp` (the recorder writes this form, and a bare `<ID>/<file>.webp` also works). Each picture is at most 120 KB. Every picture has alt text that says what it shows.
- Placeholder media for the sample articles: `content/help/placeholder/`. Real videos are release files, not committed (see Videos).

#### Front matter

A block between two `---` lines at the top of the file. It is a strict subset of YAML: `key: value` lines, inline lists `[a, b]`, quoted strings, numbers, true and false, `#` comment lines, block lists (`- item`) and one level of nested map (`video:`). Unknown keys are refused.

| Key | Required | Rule |
|---|---|---|
| `id` | yes | Path letter and two digits. Must match the folder and the file name. |
| `title` | yes | 3 to 80 characters. Task wording, verb first where it is a task. |
| `path` | yes | Folder name. |
| `summary` | yes | One sentence of fewer than 20 words. |
| `role` | yes | `editor`, `admin` or `super_admin`: the lowest role that can do the task, taken from `apps/web/src/lib/admin/can.ts`. |
| `roleNote` | no | For mixed tasks, for example "Editors can add, only Admins can delete". Up to 120 characters. |
| `needs` | no | Ids to read first. They must exist. |
| `related` | no | At most 3 ids. They must exist. |
| `readMinutes` | yes | 1 to 30. |
| `watchSeconds` | with a video | 1 to 600. Length of the video. |
| `video` | no | `id: V<ID>` (for D02, `VD02`), `phone: true` when a phone recording exists, `captions: track` (default, a live WebVTT track) or `captions: burned` (drawn into the recording, the page shows no track). Needs `watchSeconds`. |
| `screens` | no | Route patterns this article explains, for the Help link and the panel, for example `["/admin/videos/[id]"]`. The article that lists a route first is the main one for it. |
| `actions` | no | Permission ids from `can.ts` the task depends on, for example `[video.upload]`. A test checks they exist. |
| `aliases` | no | Plain words people use (thumbnail, cover). They feed search. |
| `flow` | no | The recorder episode id this article is made from. |
| `dependsOn` | no | Source paths that make the article stale when they change. |
| `verifiedAgainst` | for `verified` | Release tag and short sha, for example `v1.0.0 (abc1234)`. |
| `updated` | yes | `YYYY-MM-DD`. |
| `locale` | yes | `en`. |
| `status` | yes | `draft`, `reviewed` or `verified`. |
| `textOnly` | no | `true` only when there is no video. An article without a `video` must say `textOnly: true`, and one with a video must not. |

#### Body

Exactly five sections, with these exact `## ` titles, in this order, and no other headings:

1. `## What you will do`: one or two sentences and the result.
2. `## Before you start`: role, things to have, earlier guides.
3. `## Steps`: one numbered list and nothing else. One action per step, 25 words or fewer. A step may have indented lines under it: a short note, one picture (`   ![alt](../../media/D02/D02-01-menu-desktop.webp)`) and callouts. The block between `<!-- kb:steps D02 -->` and `<!-- /kb:steps -->` is written by the recorder and replaced on each run, so keep hand written text outside it. HTML comments are ignored.
4. `## What you should see`: the end state, with an optional picture.
5. `## If something goes wrong`: one bulleted list of one to three items. Each item is `- **The cause.** The fix. [Linked guide](help:T01)`.

The video block is added by the page when `video` is set, so it is not in the body.

Inline syntax: `**bold**` for a label on the screen, `*italic*`, `` `code` ``, and links. Allowed link targets only: `help:D02` or `help:D02#step-3` (another guide), `glossary:caption` (a glossary term), `/admin/videos` (an admin screen), `https://example.com` (external). Anything else is refused. Callouts: `> [!TIP]`, `> [!CAREFUL]` or `> [!NOTE]` on one line, then `> text` lines.

#### Copy rules checked by `help:check`

No en or em dash, no emoji, none of the banned words in `BANNED_WORDS` (`packages/help/src/lint.ts`) outside a quoted label (bold, code or in quotes), steps of 25 words or fewer. Every `needs`, `related` and `help:` link must point at an existing article. Writing rules beyond that are in plan section 5.2.

#### Glossary

`content/help/en/glossary.md` is a list of `## Term` blocks. After the heading: one definition line, then optional `Guides: D06, W05` and `Aliases: thumbnail, cover` lines. Terms are sorted A to Z by the page.

#### Videos

Video files are not in the repo. The page looks for them under the media release (`HELP_MEDIA_RELEASE`, default `sample`) at `help/<release>/<VIDEO_ID>/`: `<VIDEO_ID>-720.mp4`, `-480.mp4`, `-poster.webp`, `-captions.vtt`, and `-phone-720.mp4` when `phone: true`. H.264, no audio track. With the release `sample` every video resolves to the placeholder files in `content/help/placeholder/`.

### How to run the scoped tests

- `pnpm vitest run packages/help` (format, library, search, node loader)
- `pnpm help:check`
- `pnpm vitest run apps/web/src/components/admin/help apps/web/src/lib/admin/help-coverage.test.ts apps/web/src/server/help`
- Coverage gaps: `content/help/coverage-gaps.json` lists admin routes and menu items with no article yet. A content lane that covers one must remove it (the test fails otherwise). A new admin route needs an article with `screens` or a gap entry.
- Dockerfile copies `content/help` to `/app/content/help`; the loader finds it from the app folder or `HELP_CONTENT_DIR`.
- `pnpm vitest run apps/web/src/server/help "apps/web/src/app/admin/(shell)/help/media"` (media route, Range, isolation)
- Media release: env `HELP_MEDIA_RELEASE` (default `sample`, which serves `content/help/placeholder`). A real release is read from the originals bucket at `help/<release>/<VIDEO_ID>/<file>`. `kb:publish` (harness lane) writes it.
- `pnpm vitest run apps/web/src/components/admin/help/HelpPanel.test.tsx apps/web/src/components/admin/help/InlineHint.test.tsx apps/web/src/lib/admin/help-panel.test.ts apps/web/src/components/admin/AdminShellHelp.test.tsx` (panel)
- e2e (runs here with Chrome): start the fixture web app (`pnpm kb:stack env` values, port of your choice, no `KB_DEMO`), then `cd apps/web && E2E_BASE_URL=http://localhost:PORT E2E_CHROMIUM_PATH=/usr/bin/google-chrome pnpm exec playwright test e2e/admin-help.e2e.ts --project=desktop` (axe, layout and panel at 360, 600, 960, 1280)
- `pnpm vitest run apps/web/src/server/help/pdf.test.ts "apps/web/src/app/admin/(shell)/help/media" apps/web/src/components/admin/help/PrintButton.test.tsx` (per guide PDF route and button). Print layout is measured by the `print layout of a guide` test in `admin-help.e2e.ts` (print media, then `page.pdf`).
- Later slices add their own lines here.

## Harness (lane KB-H)

Source: `scripts/kb-recorder/`. Spike background and measurements: `docs/spikes/kb-recording.md`. Plan: `docs/plan/v2/L14-admin-knowledge-base.md` (sections 5, 6, 10, 11).

### Writing an episode

One typed module per procedure: `scripts/kb-recorder/episodes/<id>.ts`, default export an `Episode` (type in `scripts/kb-recorder/episode.ts`). The file name is the id. The episode is the only source of the video, the screenshots, the article step list and the proof that the steps work (D-361).

```ts
import type { Episode } from '../episode';
import { goToScreen, highlight } from '../helpers';

const episode: Episode = {
  id: 'D10',
  title: 'Find videos and change many at once',
  role: 'editor',                       // none (signed out), editor, admin or super_admin
  screens: ['/admin/videos'],           // routes the article explains (coverage tests)
  actions: ['video.bulk'],              // can.ts action ids it uses (coverage tests)
  dependsOn: ['apps/web/src/app/admin/videos'],   // source prefixes, used by --changed
  viewports: ['desktop', 'mobile'],     // default desktop only
  steps: [
    {
      caption: 'Choose Videos in the side menu.',   // burned in, article step, transcript line
      note: 'Editors and above can open this page.', // article only
      run: async (s) => { await goToScreen(s, 'Videos'); },
      shot: { name: 'list', alt: 'The Videos list with the search box marked 1',
              marks: [{ target: (s) => s.page.getByRole('searchbox'), label: 'Search' }] },
    },
  ],
};
export default episode;
```

Rules: one action and one sentence per step, a verb first, no dashes, no emojis, labels exactly as on screen. The recorder signs in as `role` off camera before the first step, so the video starts on the task. A signed out episode (`role: 'none'`) signs in itself in its steps.

Helpers in `scripts/kb-recorder/helpers.ts`: `signInAs`, `goToScreen`, `clickByName`, `typeInto`, `selectOption`, `waitForToast`, `scrollTo`, `highlight`, `zoom`. They find controls by role and visible label, never by CSS, and a failure names the step and lists the labels on the screen. The `Session` (`s`) adds `click`, `type`, `point`, `reveal`, `pause`, `goto`. Captions never cover the target: scrolling keeps the target above the caption band and the caption moves to the top when the target sits low (`safe-area.ts`).

### Article steps block

`renderStepsBlock` and `applyStepsBlock` (`steps-block.ts`) write the steps of an episode into an article between two markers. Text outside the markers is never touched. Format (agreed by reading the template in plan section 5.1):

```
<!-- kb:steps D10 -->
1. Choose Videos in the side menu.
   Editors and above can open this page.
   ![The Videos list with the search box marked 1](../../media/D10/D10-01-list-desktop.webp)
<!-- /kb:steps -->
```

Picture file names follow `<id>-<nn>-<name>-<desktop|mobile>.webp` (plan section 6.1). The media prefix is `../../media` by default for `content/help/en/<path>/<id>-<slug>.md`.

### Demo stack

Recording and checking run only against the isolated demo stack (D-362, D-379). Never against staging or production data.

- Fixture mode (default, no database): `pnpm kb:stack fixture 3141` starts the web app on the in memory fixtures with `KB_DEMO=on`, a frozen server clock (`KB_DEMO_NOW`, default 10 Mar 2026 10:00 Lagos, preload `scripts/kb-recorder/demo/fixed-clock.cjs`) and the reset route. `pnpm kb:stack env` prints the environment.
- Dataset: `apps/web/src/lib/data/admin/kb-demo/dataset.ts` (clearly fake names, `Demo` prefixes, sponsors and donors marked `(test)`, only example.com, example.net, example.org, example.test emails, round amounts, one video per status, a Part and Lesson series, users for each role). `checkDemoDataset` fails on anything real looking. `apply.ts` lays it over the fixture store.
- Reset: the recorder calls `POST /api/kb-demo/reset` (header `x-kb-demo: reset`, local host only, 404 unless `KB_DEMO=on` on a development fixture build) before the warm up pass and before the recorded pass of every episode, so an episode that saves something never changes what the next one shows. It also clears markers, auth, theme and notice state. The browser clock is fixed to the same pinned time.
- Origin guard: `pnpm kb:record` refuses any base URL that is not localhost, 127.0.0.1, [::1] or the demo host named in `KB_DEMO_HOST` (a reserved example name). `--no-reset` skips the reset for a plain dev server.
- Real Postgres mode: `pnpm kb:stack real` prepares databases `ad_kb` and `ad_kb_keys`, migrations, the demo catalog and one admin, and writes `.env.kb-real`. Set `KB_2FA_CODE` for the sign in helper. The reset there is a rerun of the script. Partial: only one staff account is seeded and the demo overlay (sponsors, donations, fake staff names) applies to fixture mode only. `assertAllowedDatabase` refuses any database other than `ad_kb` and `ad_kb_keys` on localhost.

### Redaction scanner and screenshots

- `scan.ts` (`scanText`): fails a capture that shows a real looking email (anything not on example.com, example.net, example.org, example.test), the `[email hidden]` marker the page redactor leaves (a real email reached the screen), a key, token or secret (`sk_`, `pk_`, AWS ids, JWT, bearer, long mixed tokens, long hex that is not a UUID), a phone number (Nigerian mobile, international, dashed) or an IP outside loopback and the documentation ranges. A finding shows the kind, the position and a masked excerpt, never the value. `allow` lists exact values a screen must show.
- `scan-page.ts` (`assertPageClean`): scans visible text, field values (not passwords), placeholders, alt and title text. The runner runs it after every step, after every navigation and click, and before every screenshot (`Session.guard`).
- Elements marked `data-kb-mask` (a QR code, a recovery code) are replaced by `DEMO-0000-0000` before capture.
- Annotation (`shapes.ts` and the overlay): numbered dark circles with a yellow highlight and a dark halo (fixed colours, not theme tokens), optional arrows (`arrow: true`), blur (`kind: 'blur'`), and a tight crop of one card (`crop`). Marks are numbered in order, blurs are not.
- `webp.ts` (`pngToWebp`): WebP at the profile width (1280 desktop, 390 phone), no metadata chunk, quality lowered until it is at most 120 KB, fails when it cannot fit. File names: `<id>-<nn>-<name>-<desktop|mobile>[-dark].webp`. `scheme: 'dark'` emulates a dark colour scheme for screens that are dark by design.

### Captions, transcript and chapters

- Style guide lint (`caption-style.ts`): `lintCaption` returns errors (dash of any kind, emoji, exclamation mark, no capital or full stop, ALL CAPITALS words, jargon such as bitrate or transcode outside a quoted or bold label, more than one action, over 20 words, not fitting two lines of 42 characters) and warnings (does not start with a verb). `lintCues` checks the burned in timing: 2 to 6 seconds, at most 15 characters a second, two lines, 42 characters a line. `episodes.test.ts` lints every caption of every episode, so a bad caption fails the scoped test.
- Reading time is 67 ms a character (15 characters a second) with a 2 s floor, so the runner holds each step long enough. `--pace` under 1 is for quick checks and skips the timing lint.
- `produceOutputs` (`produce.ts`) turns a clean capture and the measured step timings into the published files, all on the final video clock: `<id>-<profile>.mp4` (burned in captions, no audio, 3 s title card, "Step n of N" corner badge, 3 s end card when `next` is set, long waits cut), `.vtt` (WebVTT), `.ass` (burn source), `.transcript.txt` (each caption with its time and "The pointer moves to X."), `.chapters.vtt` (a chapters track).
- Wrap a long wait in `s.skippable(async () => ...)`: waits over 2.7 s are cut with 0.6 s kept on each side and a "Time skipped" badge.
- A step can start a named chapter with `chapter: 'Add details'`. With no named chapters each step is one chapter. Set `next: 'D03 Upload many videos'` on the episode for the end card.
- Captions sit at the bottom and move to the top when the target is low (per cue ASS alignment).

### Commands

Run from the repo root with the demo stack up (`pnpm kb:stack fixture 3141` in another terminal, `KB_BASE_URL` defaults to `http://localhost:3141`).

| Command | What it does |
|---|---|
| `pnpm kb:record --episode D02` | Records one episode (a comma list works: `--episode D02,D03`) |
| `pnpm kb:record --path daily` | Every episode of a learning path: `start`, `daily`, `weekly`, `setup`, `money`, `safety`, `troubleshooting` (from the first letter of the id, or the episode `path` field) |
| `pnpm kb:record --changed` | Only episodes affected by changed files: `dependsOn` prefixes, the episode's own file, or everything when the harness changed. `--base origin/main` (default) or `--files a,b` |
| `pnpm kb:record --all` | Everything |
| `pnpm kb:verify <selection>` | Locator check only: plays each episode with no video and no pacing, as the episode role, and fails naming the episode, the step, the caption and the labels on screen. `--report file.json` writes the failures |
| `pnpm kb:record --list --changed` | Prints the selected ids and does nothing else |

Options: `--profile desktop,mobile` (default: the episode `viewports`), `--out .kb-out`, `--run run1`, `--pace 1` (slower: 1.5; under 1 skips the caption timing lint), `--no-warm`, `--no-reset`, `--no-shots`, `--min-seconds 10 --max-seconds 240 --max-mb 5` (content runs use `--min-seconds 60`), `--compare previous/manifest.json` (fails when a length moved by more than 10 percent or an episode is missing), `--base-url`.

Per episode and profile, three passes: a silent warm up (dev server compile), a screenshot pass at device scale 2 (desktop) or 3 (phone) saved as WebP, then the video pass at scale 1. Each pass starts with a demo reset and the pinned clock. Output layout `.kb-out/<run>/<id>/<profile>/`:

- `<id>-<profile>.mp4` (and `-480.mp4` on desktop), `.poster.jpg`, `.vtt`, `.transcript.txt`, `.chapters.vtt`, `.ass`, `.raw.webm` (clean capture, no captions), `meta.json` (timings, problems)
- `shots/<id>-<nn>-<name>-<profile>[-dark].webp`
- `.kb-out/<run>/manifest.json`, schema 1, consumed by the platform: per episode `id`, `title`, `role`, `path`, `locale`, and per profile `video`, `renditions[{height,file,bytes}]`, `vtt`, `transcript`, `chapters`, `poster`, `width`, `height`, `bytes`, `durationMs`, `shots[{step,file,alt,bytes}]`. All paths are relative to the manifest. A `--changed` run merges into an existing manifest of the same run.

Checks per video (ffprobe): H.264, yuv420p, no audio stream, the profile size, length within the limits, size under the limit. A failing episode is not published: work happens in `<profile>.work` and replaces the old folder only after every check passed, so a failed recording leaves the previous files untouched.

### CI, screenshots baselines, publishing

- `.github/workflows/kb-verify.yml`: on pull requests touching `apps/web/src/app/admin`, `components/admin`, `lib/admin`, `lib/data/admin`, the settings registry, `scripts/kb-recorder`, `scripts/kb-stack.sh` or `content/help`, builds the app, starts `scripts/kb-stack.sh start 3141` and runs `pnpm kb:verify --changed --base origin/<base>`. A failure names the article, the step and the labels on screen and uploads `kb-verify-report.json`. Exit 1 is a content failure, exit 2 is the stack failing.
- `.github/workflows/kb-nightly.yml`: nightly (02:17 UTC), on `v*` tags and by hand. Records everything, checks length against the last run, compares screenshots, uploads `.kb-out` (without raw captures) for 14 days. The shortest allowed video is `KB_MIN_SECONDS` (default 10, a manual run can set 60). Raise the default to 60 when the content lanes have written the full playlist. No secrets are read. Validated as YAML and by `scripts/kb-workflow.test.ts`.
- `pnpm kb:shots-diff --run .kb-out/nightly --baseline content/help/media`: each screenshot against `content/help/media/<ID>/<same file name>`. Over 0.5 percent of pixels changed (or a different size) fails with a red diff picture in `.kb-out/diffs`. A picture with no baseline yet is listed as new (a failure with `--strict`). Mark a live area in the app with `data-kb-dynamic` so the diff ignores it.
- `pnpm kb:update D02`: records the episode, copies its pictures to `content/help/media/D02/` and rewrites the `kb:steps` block of its article, for a reviewed commit. `pnpm kb:steps D02 [--check]` rewrites or checks the steps block alone with no recording.
- `pnpm kb:publish --run .kb-out/nightly --release v1.0.0 --dest dist-media`: writes `help/<release>/<VIDEO_ID>/<VIDEO_ID>-720.mp4`, `-480.mp4`, `-poster.webp`, `-captions.vtt`, `-chapters.vtt`, `-transcript.txt`, `-phone-720.mp4` and `-phone-captions.vtt`, the names the help media route reads. Uploading that folder to the originals bucket is an operations step.
- Bold labels in a caption (`Click **Upload**`) are kept in the article and dropped from the burned in caption, the VTT and the transcript.

### Episode coverage (what content lanes must empty)

`apps/web/src/lib/admin/kb-episode-coverage.test.ts` (logic in `scripts/kb-recorder/coverage.ts`) fails with a clear list when any of these has no episode and no gap entry: an admin route (`page.tsx`, help pages excluded), a side menu item (`NAV_ITEMS` label), a permission action (`ADMIN_ACTIONS`), a setting (`SETTING_KEYS`) or a status (`video:<VIDEO_STATUSES>`, `publish:<PUBLISH_STATES>`, `caption:<CAPTION_STATUSES>`). An episode declares what it teaches:

```ts
screens: ['/admin/videos/[id]'],                  // routes (exact patterns, as the folder names them)
actions: ['video.publish'],                       // can.ts action ids
covers: { nav: ['Videos'], settings: ['site.name'], statuses: ['video:ready', 'publish:draft'] },
```

The test also fails when an episode names something that does not exist, when a gap entry is covered now (so the list can only shrink) and when a gap entry names something that does not exist. The allowlist of known gaps is `scripts/kb-recorder/coverage-gaps.json` (37 routes, 19 menu items, 47 actions, 106 settings, 15 statuses at the start). When you add an episode, delete the entries it covers. To rewrite the list from the current state: `KB_WRITE_GAPS=1 pnpm vitest run apps/web/src/lib/admin/kb-episode-coverage.test.ts`. This is separate from KB-P's article coverage (`content/help/coverage-gaps.json`), which checks that an article exists.

### Fact checker

`pnpm kb:fact-check --article D02` (also `--file path`, `--all`, `--role editor`, `--report out.json`) re-runs an article on a clean demo stack from only its Steps list and role. It never reads the episode, so it catches steps a new person could not follow. The demo is reset, the role signs in off camera, and each step is followed in order until the first that fails. Exit 0 all followed, 1 a step failed, 2 the stack failed.

How a step is read (write steps so this works):

- One action per step. Two actions in one step, or a step with no **bold** label, fails as unclear.
- Labels are the **bold** words and must match the screen exactly. Text to type is in quotes: `Type "Rivers" in the **Title** box.`
- Verbs: Choose or Open a menu item; Click or Press a control; Type or Enter; Tick or Untick; Select an option from a list; Wait until you see; Scroll to.
- Drag, upload or "choose a file" steps are skipped as manual and counted in the report.
- A click on a button whose name has Choose, Upload or Replace in it hands a small demo file (a video, or a picture when the box takes only pictures) to the file box it opens. Write the next step as `Choose a file from your computer.` (a manual step) and then wait for the result. A name in quotes in that step, such as `Choose a file from your computer, named "flaky-lesson.mp4".`, is the name the demo file gets, so a practice failure can be shown.
- A choice in a group is found by the label it starts with (`Click **Schedule**.` finds the radio read as "Schedule Pick a date and time."). Side menu links match with or without the count badge ("Encoding 1 need attention").
- Signing in: an article that starts with `Go to the sign in page, "/admin/login".` is followed signed out. `Type your email in the **Email** box.`, `Type your password in the **Password** box.` and `Type the 6 digit code from your app in the **Digit 1 of 6** box.` use the demo account of the role (never written in an article). Any other article is followed signed in as its role.
- A role below the article role fails before any browser opens and names both roles.

A failure names the step, why, and the labels on screen at that moment.

### Status

Slices 1 to 9 done (framework, demo stack, scanner and annotation, caption tools, pipeline commands, CI, episode coverage, fact checker, docs). Open: the real Postgres mode (`pnpm kb:stack real`) is written but not yet run end to end, and content lanes still own the episodes that empty the coverage gaps file.
