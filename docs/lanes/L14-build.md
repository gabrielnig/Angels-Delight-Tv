# L14 build: admin knowledge base (M50)

This file has two parts. The platform part (articles, help pages, search) is written by lane KB-P. The harness part below is written by lane KB-H and tells content lanes how to write episodes and run the recording tools. Both lanes append to their own part only.

## Platform (lane KB-P)

Worktree `/home/claude/wt2/KBP-build`. Builds the help centre itself: the content format, loader, pages, player, media route, panel, search, progress and the coverage tests. Content lanes write articles into `content/help`, the harness lane (KB-H) records the videos and screenshots.

### Slice status

| Slice | Contents | State |
|---|---|---|
| 1 Content format | `@ad/help` (schema, parser, library, lint, glossary, route matching), `content/help`, `pnpm help:check`, 3 sample articles, stories and decisions | Merged in the first platform PR |
| 2 Pages | `/admin/help` home, path, article with contents list, role labels, print layout, Help in the side menu and page header, `help-map.ts`, coverage tests | Not yet |
| 3 Progress | `help_progress` table, finished, watched, helpful, progress card | Not yet |
| 4 Video | private media route, player, playlist, transcript | Not yet |
| 5 Panel | contextual help drawer and sheet | Not yet |
| 6 Search and glossary | search page and highlights, glossary page | Not yet |
| 7 States and checks | offline and error states, accessibility and layout e2e, final docs | Not yet |

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

### Commands

- `pnpm kb:record --episode <id> --profile desktop,mobile --out .kb-out` records one episode (see the spike note for the stack).

### Status

Slice 1 of 9 done (episode framework). Later slices append here.
