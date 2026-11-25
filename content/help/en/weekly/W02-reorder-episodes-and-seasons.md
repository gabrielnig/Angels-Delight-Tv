---
id: W02
title: Reorder episodes and seasons
path: weekly
summary: Move lessons up or down inside a group of a series.
role: editor
needs: [W01]
related: [W24, W25, W01]
readMinutes: 2
watchSeconds: 60
video:
  id: VW02
screens: ["/admin/series/[id]"]
actions: [series.manage]
aliases: [sort, change order, move up, move down]
flow: W02
dependsOn: [apps/web/src/components/admin/SeriesEditor.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Change the order of lessons inside one group. You end with the lessons in the order viewers should watch them.

## Before you start
You need the Editor role or above. Open a series that already has lessons: [Create a series and add episodes](help:W01).

The screen has **Up** and **Down** buttons, not drag and drop. Each button names its lesson, such as **Move Demo lesson: Genesis 6, Noah and the ark up**. A lesson at the top has no Up, and the last has no Down.

## Steps
<!-- kb:steps W02 -->
<!-- /kb:steps -->

## What you should see
A message says **Order saved.** The lessons swap numbers, so the lesson you moved up now has the smaller number.

> [!NOTE]
> To move a lesson to another group, see [Move a lesson to another group and rename groups](help:W24).

## If something goes wrong
- **Up or Down is grey.** The lesson is already first or last in its group.
- **The numbers look wrong afterwards.** The series may have a gap or a repeat. [Fix gaps and duplicate numbers](help:W25)
