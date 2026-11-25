# L14 build: admin knowledge base (M50)

This file has two parts. The platform part (articles, help pages, search) is written by lane KB-P. The harness part below is written by lane KB-H and tells content lanes how to write episodes and run the recording tools. Both lanes append to their own part only.

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
