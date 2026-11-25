---
id: D07
title: Review and approve captions
path: daily
summary: Check the captions made for a video and approve them.
role: editor
needs: [D02]
related: [D05, D08]
readMinutes: 5
watchSeconds: 80
video:
  id: VD07
  phone: true
  captions: burned
screens: ["/admin/captions", "/admin/captions/[videoId]"]
actions: [caption.review]
aliases: [subtitles, cc, closed captions, approve, review words]
flow: D07
dependsOn: [apps/web/src/components/admin/CaptionReview.tsx, apps/web/src/components/admin/CaptionTable.tsx, apps/web/src/components/admin/CaptionList.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Check the [captions](glossary:caption) made for a new video and approve them. You end with the state **Approved**, so viewers can see the words.

## Before you start
- **Who can do this:** Editors, Admins and Super admins. Only Admins can approve many videos at once.
- **Time:** about 5 minutes for a short video.
- The video must be uploaded and its captions made. The state in the list says **Needs review** when they are ready.
- Read [Upload one video](help:D02) if you have not yet.

## Steps
<!-- kb:steps D07 -->
1. Choose **Captions** in the side menu.
   ![The Captions list with the oldest waiting video marked 1](../../media/D07/D07-01-list-desktop.webp)
2. Click **Review captions for How Plants Make Food**.
   A video that needs a check has a blue Review button.
   ![The caption review screen with the video and the cue list marked 1](../../media/D07/D07-02-review-desktop.webp)
3. Click **Play** to watch the video with its captions.
4. Click **Pause** when you want to read a cue.
5. Check that **Approving is allowed with warnings** shows under the video.
   ![The warnings note under the video marked 1](../../media/D07/D07-05-cues-desktop.webp)
6. Click **Approve captions**.
   Approve only when the words match what is said. Anyone can still edit them later.
   ![The Approve captions button marked 1](../../media/D07/D07-06-approve-desktop.webp)
7. Wait until you see **Captions approved**.
   ![The message Captions approved marked 1](../../media/D07/D07-07-approved-desktop.webp)
<!-- /kb:steps -->

## What you should see
A message says **Captions approved**. In the **Captions** list the state of the video is **Approved**, and the number beside **Captions** in the side menu goes down by one.

> [!NOTE]
> Approving is a review, so it has no Undo. You can still change the words later and choose **Approve changes**.

## If something goes wrong
- **The list says No captions waiting.** Nothing needs review. New videos appear here when their captions are ready.
- **A video says Generating.** The captions are still being made. Come back in a few minutes.
- **The words are wrong in many places.** Edit the cues on this screen before you approve. Each cue has its own **Words in cue** box.
