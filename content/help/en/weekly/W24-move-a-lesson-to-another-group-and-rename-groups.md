---
id: W24
title: Move a lesson to another group and rename groups
path: weekly
summary: Give a group its own title and move a lesson into a different group.
role: editor
needs: [W02]
related: [W02, W25, W20]
readMinutes: 3
watchSeconds: 90
video:
  id: VW24
screens: ["/admin/series/[id]"]
actions: [series.manage]
aliases: [change part, change book, rename part, move lesson]
flow: W24
dependsOn: [apps/web/src/components/admin/SeriesEditor.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Rename a [group](glossary:group) and move one [item](glossary:item) into another group. You end with a group titled Creation and a lesson moved from Part 2 into Part 1.

## Before you start
You need the Editor role or above. Open a series with at least two groups, such as the Genesis demo series.

There is no one click move. You change the group number and the lesson number of the video, then save. Pick a lesson number that is free in the new group.

## Steps
<!-- kb:steps W24 -->
<!-- /kb:steps -->

## What you should see
A message says **Title saved.** and later **Numbers saved.** The moved lesson now appears under the other group, in its new place.

> [!TIP]
> The group title is shown beside the group word, for example Part 1: Creation.

## If something goes wrong
- **A warning says Check the numbers.** Two lessons share a number in the group. [Fix gaps and duplicate numbers](help:W25)
- **The title does not save.** It can be up to 60 characters. Shorten it and click the save button again.
