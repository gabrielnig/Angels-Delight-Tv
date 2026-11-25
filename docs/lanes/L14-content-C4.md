# Lane C4 content manifest: series and organising content (M50)

Worktree `/home/claude/wt2/C4-content`, branch `c4/series-batch1` (work in progress, not merged). Demo port 3204, raw output `/home/claude/kb-out/C4`.

## Ids (new ids added to the plan inventory, section 3.4)
Existing ids used: W01, W02, W03. New ids W20 to W33 (W14 to W19 left free for other lanes):
W20 Plan a series: groups and items; W21 Choose the series names for your whole site; W22 Use different names for one series; W23 Add many videos to a series; W24 Move a lesson to another group and rename groups; W25 Fix gaps and duplicate numbers; W26 Set a series maturity rating and apply it to every lesson; W27 See how a series looks to viewers; W28 Remove a series without losing videos; W29 Organise your library with categories and tags; W30 Change many videos at once; W31 Approve many captions at once; W32 Retry many failed encodes at once; W33 Upload many videos and set the details together.
Glossary terms added: Group, Item, Name set.

## Demo seed
`apps/web/src/lib/data/admin/kb-demo/apply.ts` and `dataset.ts` now add: series "Demo series: Genesis" (Part and Lesson, Part 1 Beginnings with 3 lessons, Part 2 The family of Abraham with 2), three unassigned Genesis 37, 41, 45 lessons for bundling, and "Demo series: Proverbs" (Part and Lesson, lesson numbers 1, 3, 3: a gap and a duplicate). 11 videos added, all published. Other lanes that baseline Videos list or Dashboard counts must re-record.

## State (batch 1 merged)
Articles with recorded pictures, steps blocks and a passing fact check: W02, W20, W21, W22, W24, W25, W26, W28 (8). W01 article written, locator fixed (Add episode), fact check to rerun. W03 belongs to lane C1 (removed here).
Episodes written but article not yet in the repo (drafts kept in /home/claude/kb-out/C4/pending, regenerate with gen-articles.py): W23, W27, W29, W30, W31, W32, W33. Search box locator fixed with getByRole('searchbox'); W23 and W30 need a re-run.
No videos were recorded (kb:update records them but they are not committed); no phone pictures.
Coverage gaps closed: series routes, Series, Site settings, Captions, Encoding nav, content.series_labels, series.manage, series.delete, settings.site, caption.approve_bulk, video.edit, video.upload.

## Next steps
Run `/home/claude/kb-slot.sh` batches: `pnpm kb:update` then `pnpm kb:fact-check --article` for W01, W23, W27, W29 to W33; restore their articles and links (help:W23 etc.), then PR.
