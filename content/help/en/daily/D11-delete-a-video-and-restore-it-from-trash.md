---
id: D11
title: Delete a video and restore it from Trash
path: daily
summary: Move a video to Trash and bring it back within 30 days.
role: admin
roleNote: Editors can restore from Trash. Only Admins can move a video to Trash.
needs: [D10]
related: [D10, D08]
readMinutes: 3
watchSeconds: 70
video:
  id: VD11
  captions: burned
screens: ["/admin/videos/trash"]
actions: [video.delete, video.restore]
aliases: [delete, remove, bin, trash, restore, undelete, get back]
flow: D11
dependsOn: [apps/web/src/components/admin/TrashList.tsx, apps/web/src/components/admin/VideoEditor.tsx, apps/web/src/app/admin/(shell)/videos/trash]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Move a video to [Trash](glossary:trash) and bring it back. A video waits in Trash for 30 days before it is deleted for good.

## Before you start
- **Who can do this:** Admins and Super admins can move a video to Trash. Editors can open Trash and restore videos.
- **Time:** about 3 minutes.
- Read [Find videos and change many at once](help:D10) first if you have not.
- Moving to Trash hides the video from viewers at once.

## Steps
<!-- kb:steps D11 -->
1. Choose **Videos** in the side menu.
<!-- /kb:steps -->

## What you should see
The video is back in [Videos](/admin/videos) as a draft. Publish it again when you are ready, see [Publish or unpublish a video](help:D08).

> [!CAREFUL]
> **Delete forever** in Trash cannot be undone, and only Admins can use it. Check the title twice.

## If something goes wrong
- **Move to Trash is grey.** Only an Admin can move a video to Trash. Ask an Admin.
- **The video is not in Trash.** It may have been deleted for good after 30 days. Upload it again if you still have the file.
- **You restored the wrong video.** Choose **Undo** in the message, or move the video to Trash again.
