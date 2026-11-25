---
id: T01
title: A video is stuck on Encoding or says Failed
path: troubleshooting
summary: Find out if a video is still preparing or failed, and use Retry.
role: editor
related: [D12, C14, T15]
needs: [D12]
readMinutes: 3
watchSeconds: 90
video:
  id: VT01
  phone: true
screens: ["/admin/encoding", "/admin/encoding/failed"]
actions: [encode.retry]
aliases: [stuck, processing, converting, spinner, not ready, failed video, retry]
flow: T01
dependsOn: [apps/web/src/components/admin/EncodingQueue.tsx, apps/web/src/components/admin/FailedEncodes.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Check whether a new video is still being prepared or has failed, read the reason and use **Retry**. You end with the video moving again.

## Before you start
You need the Editor role or above. Have the video title ready. After an upload, the site prepares the video in a few stages, so a new video is not ready at once. This is called [encoding](glossary:encoding).

## Steps
<!-- kb:steps T01 -->
1. Choose **Encoding** in the side menu.
   Editors and above can open this page. It updates by itself every few seconds.
   ![The Encoding queue with one video preparing and one that failed](../../media/T01/T01-01-queue-desktop.webp)
2. Check the **Failed encodes** section.
3. Check the **Processing** badge for your video.
   A long video can stay on one stage for several minutes. This is normal.
   ![The stage text and progress bar under a video title, marked 1](../../media/T01/T01-03-progress-desktop.webp)
4. Wait until **Processing** shows the progress bar moving.
5. Scroll to **Failed** in the list.
6. Check that **It did not finish** appears in the red box.
   Your original file is safe. A failed encode never deletes it.
   ![A failed video with the reason in a red box and the Retry button marked 1](../../media/T01/T01-06-failed-desktop.webp)
7. Click **Retry encoding Our Solar System**.
<!-- /kb:steps -->

## What you should see
A video that was preparing shows a blue **Processing** badge and a bar that moves. A video you retried shows a message that it is back in the queue, then moves along the stages.

> [!TIP]
> A long video can take longer than a short one. If the bar still moves, wait. Only a red **Failed** badge needs action.

## If something goes wrong
- **The bar has not moved for over an hour.** Leave it a little longer on a very large file, then ask the developer to look at it. What to send is in the guide for asking the developer
- **Retry fails again.** Upload the video file again from its page, then ask the developer if that also fails. [An upload keeps failing](help:T05)
- **The Retry button is missing.** Only a video that failed shows it. A Super admin can also retry other failed jobs on **System**. See the guide on failed jobs and emails
