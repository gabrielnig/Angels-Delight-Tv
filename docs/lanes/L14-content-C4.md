# Lane C4 content manifest: series and organising content (M50)

Worktree `/home/claude/wt2/C4-content`, branch `c4/series-batch1` (work in progress, not merged). Demo port 3204, raw output `/home/claude/kb-out/C4`.

## Ids (new ids added to the plan inventory, section 3.4)
Existing ids used: W01, W02, W03. New ids W20 to W33 (W14 to W19 left free for other lanes):
W20 Plan a series: groups and items; W21 Choose the series names for your whole site; W22 Use different names for one series; W23 Add many videos to a series; W24 Move a lesson to another group and rename groups; W25 Fix gaps and duplicate numbers; W26 Set a series maturity rating and apply it to every lesson; W27 See how a series looks to viewers; W28 Remove a series without losing videos; W29 Organise your library with categories and tags; W30 Change many videos at once; W31 Approve many captions at once; W32 Retry many failed encodes at once; W33 Upload many videos and set the details together.
Glossary terms added: Group, Item, Name set.

## Demo seed
`apps/web/src/lib/data/admin/kb-demo/apply.ts` and `dataset.ts` now add: series "Demo series: Genesis" (Part and Lesson, Part 1 Beginnings with 3 lessons, Part 2 The family of Abraham with 2), three unassigned Genesis 37, 41, 45 lessons for bundling, and "Demo series: Proverbs" (Part and Lesson, lesson numbers 1, 3, 3: a gap and a duplicate). 11 videos added, all published. Other lanes that baseline Videos list or Dashboard counts must re-record.

## State
| Id | Article | Episode | Shots | Video | Fact check |
|---|---|---|---|---|---|
| W20 to W23, W01 | written (steps block empty) | written (W20, W21, W22, W23, W01) | not taken | not recorded | not run |
| W02, W24 to W33, W03 | not started | not started | | | |

## Blockers seen
The shared 8 GB container is out of memory when several lanes run dev servers and Chrome: the demo dev server and the recorder browser were OOM killed (dmesg shows cgroup kills), and the first compile of each admin route takes 30 to 120 s. `next build` was SIGKILLed. Warm routes with curl first (`/home/claude/kb-out/C4/warm.sh`), start the stack alone, then run `pnpm kb:verify --episode W20` before `kb:update`.

## Next steps for a fresh agent
1. `pnpm kb:stack fixture 3204`, run warm.sh, `KB_BASE_URL=http://localhost:3204 pnpm kb:verify --episode W20,W21,W22,W23,W01` and fix locators (label names such as `Add Episode`, heading `Part 1` are unverified).
2. `pnpm kb:update <id>` per episode (writes shots and the steps block), then `pnpm kb:record --episode <id> --min-seconds 60`, `pnpm kb:fact-check --article <id>`, `pnpm help:check`.
3. `W23` and the others reference D10, W25, W01 and W02: add `needs` and links only once those articles exist on main (help:check refuses missing ids).
4. Remove closed gaps from `scripts/kb-recorder/coverage-gaps.json` (Series, Site settings nav, `/admin/series`, `/admin/series/[id]`, `/admin/site-settings`, setting `content.series_labels`, action `series.manage`, `settings.site`) keeping other lanes' entries.
5. Update `ai-context.md` (scripts/design-doc-sync.test.ts) and open PRs of about 5 articles with `gh api`, rebase merge.
