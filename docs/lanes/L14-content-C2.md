# L14 content lane C2: weekly tasks (module M50)

Worktree `/home/claude/wt2/C2-content`, branch prefix `c2/`. Raw outputs under `/home/claude/kb-out/C2` (never committed). Demo port 3202, fixture mode.

## How to continue (for a fresh agent)

1. Episodes are in `scripts/kb-recorder/episodes/<ID>.ts`, articles in `content/help/en/weekly/`.
2. The machine is small, so every heavy step goes through `/home/claude/kb-slot.sh`. My batch script `/home/claude/kb-out/C2/batch.sh record W10,W11 ...` starts a dev server on 3202, records, deletes raw webm and stops the server. `WARM="/admin/x ..."` pre-compiles routes.
3. After a recording: copy `shots/*.webp` to `content/help/media/<ID>/`, copy `.vtt` and `.transcript.txt` to `content/help/captions/<ID>/`, run `pnpm kb:steps <ID>`, set `watchSeconds` from the video length, then `pnpm help:check` and `pnpm kb:fact-check --article <ID>`.

## Articles

| Id | Title | Episode | State |
|---|---|---|---|
| W03 | Manage categories | W03 | written, not recorded |
| W06 | Add skip intro, recap and chapters | W06 | written, not recorded |
| W09 | Turn captions on or off for one video | W09 | written, not recorded |
| W10 | Read Analytics (desktop and phone) | W10 | written, recording queued |
| W11 | See how one video is doing | W11 | written, not recorded |
| W12 | Make and download a report | W12 | written, not recorded |
| W13 | Clean up Trash and failed encodes | W13 | written, not recorded |

## Where the real UI differs from the plan

- Exports has no New export button. A report starts from Analytics (Export CSV) or the Audit log (Super admin). Large reports (over 10,000 rows) are confirmed on `/admin/exports/new`, built in the background and emailed. Fixture mode has no background exports, so the Exports list is empty there (W12 shows the empty state only).
- Categories: Delete is refused while videos use the category, there is no reassign. The article says to hide it or move the videos first.
- Per video analytics page crashed on every server (a function passed from a server page to the Chart client component). Fixed in this lane with a regression test.
- Encoding and Captions side menu links carry a badge, so their accessible name is "Encoding1 need attention". W13 reaches Failed encodes from the Dashboard link Open in Encoding instead of the menu.
- The Skip and chapters preview cannot play in fixture mode ("Connection lost"), so Use current time cannot be shown. W06 types the times.

## Not covered here (owned by other lanes at the time of writing)

Series (W01, W02, W20 to W23: C4), safety and users (K04 to K06: C6), troubleshooting (C7), money (C5), reference (C1, C3). Replying to viewers: the product has no inbox or reply path, only the support email shown to viewers (setting `help.support_contact`); no article was written.
