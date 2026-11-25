---
id: W31
title: Approve many captions at once
path: weekly
summary: Approve the captions of several videos together from the Captions list.
role: admin
needs: [D07]
related: [D07]
readMinutes: 3
watchSeconds: 60
video:
  id: VW31
screens: ["/admin/captions"]
actions: [caption.approve_bulk]
aliases: [bulk approve, approve all captions, subtitles]
flow: W31
dependsOn: [apps/web/src/components/admin/CaptionTable.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Approve captions for many videos in one go. You end with all the ticked videos showing approved captions.

## Before you start
You need the Admin role or above. Editors approve one video at a time. Read [Review and approve captions](help:D07) first and check at least a few videos by eye.

Only rows that are ready to approve count. The button shows how many, for example **Approve 2**.

## Steps
<!-- kb:steps W31 -->
<!-- /kb:steps -->

## What you should see
A result lists each video approved and any that were skipped with a reason.

> [!CAREFUL]
> Approving many captions without reading them can put wrong words on screen. Spot check first.

## If something goes wrong
- **The Approve button says Approve 0.** None of the ticked rows are ready to approve.
- **You are an Editor.** Ask an Admin, or approve one video at a time. [Review and approve captions](help:D07)
