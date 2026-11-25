---
id: W33
title: Upload many videos and set the details together
path: weekly
summary: Add several files at once and give them the same category and rating.
role: editor
needs: [S04]
related: [W30]
readMinutes: 3
watchSeconds: 45
video:
  id: VW33
screens: ["/admin/videos/upload"]
actions: [video.upload]
aliases: [bulk upload, upload details, many files]
flow: W33
dependsOn: [apps/web/src/components/admin/UploadScreen.tsx, apps/web/src/components/admin/UploadDetailsForm.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Upload many files and set shared details once. You end with all the files uploading with the same category, rating and suitability.

## Before you start
You need the Editor role or above. Read Upload many videos and share details.

Choosing files needs a file from your computer, so the recording shows only the Upload screen. After you add the files, use **Edit details for all** to set the category and rating once, and override a single file if it differs.

## Steps
<!-- kb:steps W33 -->
<!-- /kb:steps -->

## What you should see
Each file has its own row and progress bar. The shared details show on every row.

> [!NOTE]
> The video cannot show choosing files in the demo. The steps after the screen opens are described here, not recorded.

## If something goes wrong
- **A file will not start.** Check the type is MP4, MOV or MKV. An upload keeps failing
- **You set the wrong rating.** Use [Change many videos at once](help:W30) to fix it.
