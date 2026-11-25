# L14 content lane C1: Start here and Daily tasks (module M50)

Worktree `/home/claude/wt2/C1-content`, demo stack on port 3201 (production build, started through `/home/claude/kb-slot.sh`), raw outputs in `/home/claude/kb-out/C1` (never committed, raw webm deleted after burning).

## What this lane owns

| Path | Ids | Notes |
|---|---|---|
| Start here (`start/`) | S01 to S08 | S03 is text only (see below) |
| Daily tasks (`daily/`) | D01 to D12 | D11 is for Admins (moving to Trash is an Admin action) |
| Episodes | `scripts/kb-recorder/episodes/` S01, S02, S04 to S08, D01 to D12 | helpers in `scripts/kb-recorder/c1-common.ts` |

## Harness additions made by this lane (PR 444 and the content PR)

- The fact checker starts signed out when the first step is `Go to the sign in page, "/admin/login".` and types the demo account for `your email`, `your password` and `the 6 digit code`.
- A click on a button named Choose, Upload or Replace hands a demo file to the file box. A following `Choose a file from your computer, named "x.mp4".` gives the demo file that name.
- A radio choice is found by the label it starts with (`Schedule`), but a control named exactly like the label always wins, and inside an open box the control in the box is used. A click in a box that stayed open is repeated once. Ticks get one retry. `Wait until you see` ignores hidden copies of the text. The account menu (a details summary) is found by its words in order.
- The page text scan survives a click that changes the page. The KB demo reset also clears help progress (it kept Mark as done between runs).

## Differences between the plan and the real screens

- The finished upload row says "Uploaded just now", not "Done". The plan and the old sample said Done.
- The sign in screens say "two factor", the plan says "two step". Articles name the screen words where a label is quoted.
- "Preview as viewer" opens `/watch/<id>` on the fixture build, which says "This video is not available" for a draft. On a real build it opens `/admin/videos/<id>/preview`.
- On a phone the Videos and Captions lists are stacks of cards, so the Edit and Review buttons are not there. The title is the link. Episodes use `rowLink`.
- The Captions list is not sorted so that the review items come first, and the review screen has no "oldest first" rule for what to open. Items waiting show a blue Review button.
- Poster frame buttons are named like "0:34 Use this" (the time, then the action). The picked frame reads "2:47 , selected Selected". The poster needs a Poster description (alt text) before Save poster does anything.
- The Date box of the Schedule choice follows the language of the browser, not the site. The recorder and the checker browser type month first, so the article says "03/12/2026" for 12 March and tells the reader the order follows their browser. The confirm button reads "Schedule for 12 Mar, 9:00".
- The account menu button is named from the signed in name. On the practice site that is "Account menu for Demo Editor", not the demo account name.
- Messages such as "is live" and "Undo" disappear after a few seconds, so steps wait for something that stays (the Unpublish button, the Select all box, the Before you publish card).
- The Dashboard storage card shows a note to Editors instead of numbers.

## Could not be shown in fixture mode

- First sign in with the authenticator setup (QR code, recovery codes) and the recovery code box: real sign in only. S02 describes it without pictures.
- Accepting an invite (S03): the fixture build always says the invite has expired. S03 is text only and has no video. The route `/admin/invite/[token]` stays in the episode gap list.
- The staff preview player playing a video (S07): the fixture has no stream, the player shows "Connection lost".
- Real encoding progress and real captions arriving for a new upload (S06 stops at the checklist).
- The offline handbook (S08) is release tooling that is not built yet. The article says to ask the developer.

## Result

All 20 articles, 19 episodes (S03 is text only) and 121 annotated WebP screenshots (all under 120 KB). 27 videos (19 desktop, 8 phone: S02, S04, D01, D02, D05, D07, D08, D12), all between 1 and 2 minutes 35 seconds. `pnpm kb:fact-check` passes for every article except S03, which cannot be run in fixture mode (D02, D03, D04 and S06 have one manual step each: choosing a file). VTT and transcripts are committed under `content/help/captions/<ID>/`. Videos are not committed. One PR carried the whole lane (the branch held every article, so it was not split into four).

Not mine and failing on main: `help-coverage.test.ts` (routes `/admin/series/[id]/share` and `/admin/videos/[id]/share` have no article or gap entry, and the role rule for W05, W08, C10 and C14).

## Manifest of the videos

| Guide | Profile | Length | Size | Pictures | Captions and transcript |
|---|---|---|---|---|---|
| D01 | desktop | 62.6 s | 1.29 MB | 5 | `content/help/captions/D01/` (release `VD..` names via kb:publish) |
| D01 | mobile | 62.1 s | 1.22 MB | 5 | `content/help/captions/D01/` (release `VD..` names via kb:publish) |
| D02 | desktop | 62.0 s | 1.18 MB | 5 | `content/help/captions/D02/` (release `VD..` names via kb:publish) |
| D02 | mobile | 61.3 s | 1.27 MB | 5 | `content/help/captions/D02/` (release `VD..` names via kb:publish) |
| D03 | desktop | 64.0 s | 1.21 MB | 5 | `content/help/captions/D03/` (release `VD..` names via kb:publish) |
| D04 | desktop | 61.3 s | 1.19 MB | 2 | `content/help/captions/D04/` (release `VD..` names via kb:publish) |
| D05 | desktop | 70.6 s | 1.8 MB | 7 | `content/help/captions/D05/` (release `VD..` names via kb:publish) |
| D05 | mobile | 70.4 s | 1.12 MB | 7 | `content/help/captions/D05/` (release `VD..` names via kb:publish) |
| D06 | desktop | 63.0 s | 1.75 MB | 4 | `content/help/captions/D06/` (release `VD..` names via kb:publish) |
| D07 | desktop | 63.0 s | 1.09 MB | 5 | `content/help/captions/D07/` (release `VD..` names via kb:publish) |
| D07 | mobile | 62.3 s | 1.01 MB | 5 | `content/help/captions/D07/` (release `VD..` names via kb:publish) |
| D08 | desktop | 62.7 s | 1.58 MB | 4 | `content/help/captions/D08/` (release `VD..` names via kb:publish) |
| D08 | mobile | 62.7 s | 1.26 MB | 4 | `content/help/captions/D08/` (release `VD..` names via kb:publish) |
| D09 | desktop | 60.8 s | 1.53 MB | 2 | `content/help/captions/D09/` (release `VD..` names via kb:publish) |
| D10 | desktop | 69.1 s | 1.27 MB | 4 | `content/help/captions/D10/` (release `VD..` names via kb:publish) |
| D11 | desktop | 61.1 s | 1.71 MB | 3 | `content/help/captions/D11/` (release `VD..` names via kb:publish) |
| D12 | desktop | 62.6 s | 0.71 MB | 5 | `content/help/captions/D12/` (release `VD..` names via kb:publish) |
| D12 | mobile | 62.7 s | 0.52 MB | 5 | `content/help/captions/D12/` (release `VD..` names via kb:publish) |
| S01 | desktop | 73.3 s | 1.44 MB | 8 | `content/help/captions/S01/` (release `VD..` names via kb:publish) |
| S02 | desktop | 61.7 s | 0.54 MB | 3 | `content/help/captions/S02/` (release `VD..` names via kb:publish) |
| S02 | mobile | 62.3 s | 0.4 MB | 3 | `content/help/captions/S02/` (release `VD..` names via kb:publish) |
| S04 | desktop | 62.2 s | 1.1 MB | 4 | `content/help/captions/S04/` (release `VD..` names via kb:publish) |
| S04 | mobile | 62.6 s | 0.8 MB | 4 | `content/help/captions/S04/` (release `VD..` names via kb:publish) |
| S05 | desktop | 62.4 s | 2.18 MB | 5 | `content/help/captions/S05/` (release `VD..` names via kb:publish) |
| S06 | desktop | 88.8 s | 3.04 MB | 5 | `content/help/captions/S06/` (release `VD..` names via kb:publish) |
| S07 | desktop | 73.4 s | 1.18 MB | 2 | `content/help/captions/S07/` (release `VD..` names via kb:publish) |
| S08 | desktop | 62.0 s | 1.91 MB | 3 | `content/help/captions/S08/` (release `VD..` names via kb:publish) |

## Batches

| Batch | Articles | PR | State |
|---|---|---|---|
| 1 | S01 to S08, D01 to D12 (all) | see the PR for branch c1/batch1 | merged when this note was written |

## Scoped checks

`pnpm help:check`, `pnpm vitest run packages/help/src/node.test.ts apps/web/src/lib/admin/kb-episode-coverage.test.ts apps/web/src/lib/admin/help-coverage.test.ts scripts/kb-recorder/episodes.test.ts scripts/kb-recorder/fact-check.test.ts scripts/kb-recorder/fact-run.test.ts`, `scripts/footprint-check.sh`.
