# Lane C4 content manifest: series and organising content (M50)

Worktree `/home/claude/wt2/C4-content`, branch `c4/series-batch1` (work in progress, not merged). Demo port 3204, raw output `/home/claude/kb-out/C4`.

## Ids (new ids added to the plan inventory, section 3.4)
Existing ids used: W01, W02, W03. New ids W20 to W33 (W14 to W19 left free for other lanes):
W20 Plan a series: groups and items; W21 Choose the series names for your whole site; W22 Use different names for one series; W23 Add many videos to a series; W24 Move a lesson to another group and rename groups; W25 Fix gaps and duplicate numbers; W26 Set a series maturity rating and apply it to every lesson; W27 See how a series looks to viewers; W28 Remove a series without losing videos; W29 Organise your library with categories and tags; W30 Change many videos at once; W31 Approve many captions at once; W32 Retry many failed encodes at once; W33 Upload many videos and set the details together.
Glossary terms added: Group, Item, Name set.

## Demo seed
`apps/web/src/lib/data/admin/kb-demo/apply.ts` and `dataset.ts` now add: series "Demo series: Genesis" (Part and Lesson, Part 1 Beginnings with 3 lessons, Part 2 The family of Abraham with 2), three unassigned Genesis 37, 41, 45 lessons for bundling, and "Demo series: Proverbs" (Part and Lesson, lesson numbers 1, 3, 3: a gap and a duplicate). 11 videos added, all published. Other lanes that baseline Videos list or Dashboard counts must re-record.

## State (all merged or in the final PR)
Articles with pictures, filled steps blocks and a passing fact check: W01, W02, W20, W21, W22, W23, W24, W25, W26, W27, W28, W29, W30, W31, W32, W33 (16). W03 belongs to lane C1.
Limits shown in the articles: W27 records the admin side only (the demo series are not on the viewer demo site, and Preview site opens a new tab). W31 stops at the selection bar because the demo has no caption ready for bulk approval. W33 shows only the Upload screen because choosing files is a manual step.
Not done: committed videos (mp4 not committed, `pnpm kb:record` makes them), phone pictures, a second look at ai-context.md.
Coverage gaps for the series routes, Series, Site settings, Captions, Encoding, content.series_labels, series.manage, series.delete, settings.site, caption.approve_bulk, video.edit and video.upload are closed.
