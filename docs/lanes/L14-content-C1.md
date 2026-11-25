# L14 content lane C1: Start here and Daily tasks (module M50)

Worktree `/home/claude/wt2/C1-content`, demo stack on port 3201 (production build, started through `/home/claude/kb-slot.sh`), raw outputs in `/home/claude/kb-out/C1` (never committed, raw webm deleted after burning).

## What this lane owns

| Path | Ids | Notes |
|---|---|---|
| Start here (`start/`) | S01 to S08 | S03 is text only (see below) |
| Daily tasks (`daily/`) | D01 to D12 | D11 is for Admins (moving to Trash is an Admin action) |
| Episodes | `scripts/kb-recorder/episodes/` S01, S02, S04 to S08, D01 to D12 | helpers in `scripts/kb-recorder/c1-common.ts` |

## Harness additions made by this lane (merged first, PR 444 and the batch 1 PR)

- The fact checker starts signed out when the first step is `Go to the sign in page, "/admin/login".` and types the demo account for `your email`, `your password` and `the 6 digit code`.
- A click on a button named Choose, Upload or Replace hands a demo file to the file box. A following `Choose a file from your computer, named "x.mp4".` gives the demo file that name.
- A radio choice is found by the label it starts with (`Schedule`), and side menu links match with the count badge (`Encoding 1 need attention`).

## Differences between the plan and the real screens

- The finished upload row says "Uploaded just now", not "Done". The plan and the old sample said Done.
- The sign in screens say "two factor", the plan says "two step". Articles name the screen words where a label is quoted.
- "Preview as viewer" opens `/watch/<id>` on the fixture build, which says "This video is not available" for a draft. On a real build it opens `/admin/videos/<id>/preview`.
- On a phone the Videos and Captions lists are stacks of cards, so the Edit and Review buttons are not there. The title is the link. Episodes use `rowLink`.
- The Captions list is not sorted so that the review items come first, and the review screen has no "oldest first" rule for what to open. Items waiting show a blue Review button.
- Poster frame buttons are named like "CO 0:34 Use this" (the first letters of the title, the time, the action).
- The Dashboard storage card shows a note to Editors instead of numbers.

## Could not be shown in fixture mode

- First sign in with the authenticator setup (QR code, recovery codes) and the recovery code box: real sign in only. S02 describes it without pictures.
- Accepting an invite (S03): the fixture build always says the invite has expired. S03 is text only and has no video. The route `/admin/invite/[token]` stays in the episode gap list.
- The staff preview player playing a video (S07): the fixture has no stream, the player shows "Connection lost".
- Real encoding progress and real captions arriving for a new upload (S06 stops at the checklist).
- The offline handbook (S08) is release tooling that is not built yet. The article says to ask the developer.

## Batches

| Batch | Articles | PR | State |
|---|---|---|---|
| 1 | S01, S02, S04, S05, S07 | | in progress |
| 2 | D01, D02, D05, D07, D08 | | |
| 3 | S03, S06, S08, D03, D04 | | |
| 4 | D06, D09, D10, D11, D12 | | |

## Scoped checks

`pnpm help:check`, `pnpm vitest run packages/help/src/node.test.ts apps/web/src/lib/admin/kb-episode-coverage.test.ts apps/web/src/lib/admin/help-coverage.test.ts scripts/kb-recorder/episodes.test.ts scripts/kb-recorder/fact-check.test.ts scripts/kb-recorder/fact-run.test.ts scripts/kb-recorder/menu-name.test.ts`, `scripts/footprint-check.sh`.
