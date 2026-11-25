---
id: T02
title: A video will not publish
path: troubleshooting
summary: Find what is missing and fix it so you can publish.
role: editor
readMinutes: 3
watchSeconds: 90
video:
  id: VT02
screens: ["/admin/videos/[id]"]
actions: [video.publish]
aliases: [publish, go live, greyed out, cannot publish, checklist]
flow: T02
dependsOn: [apps/web/src/components/admin/VideoEditor.tsx, apps/web/src/components/admin/ChecklistCard.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Open the **Before you publish** list for a video and fix what is missing. You end with every item ticked and the video ready to [publish](glossary:publish).

## Before you start
You need the Editor role or above. A video has six things to finish before it can go live: uploaded, encoded, poster, approved captions, details and a maturity rating.

## Steps
<!-- kb:steps T02 -->
1. Choose **Videos** in the side menu.
2. Type "Naira" in the **Search** box.
3. Click **Edit Counting Money in Naira**.
4. Check the **Before you publish** list on the right.
   ![The Before you publish list with the open item marked 1](../../media/T02/T02-04-checklist-desktop.webp)
5. Check the **Needs attention** items.
   Each item says in plain words what is missing. The count shows how many are done.
6. Click **Fix this** under Poster.
   ![The screen that opens to fix the missing item](../../media/T02/T02-06-fix-desktop.webp)
<!-- /kb:steps -->

## What you should see
Each item you fix changes from needing attention to done, and the count in **Before you publish** goes up. When all six are done, **Publish** opens the publish choices.

> [!NOTE]
> **Publish** is also grey while the video is still preparing, after a failed encode, or while you have unsaved changes. The button explains why when you point at it.

## If something goes wrong
- **Encoded needs attention.** The video is still preparing or failed. Wait for it, or use **Retry** on the Encoding screen. [Stuck on Encoding](help:T01)
- **Captions approved needs attention.** The captions are missing, still being made or not approved. [Captions are missing or wrong](help:T03)
- **You are an Editor and need to publish without captions.** Only an Admin can publish without approved captions, and must give a reason. [Roles and permissions](help:R02)
