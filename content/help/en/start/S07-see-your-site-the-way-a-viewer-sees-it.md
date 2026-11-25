---
id: S07
title: See your site the way a viewer sees it
path: start
summary: Open a video as a viewer would see it, before you publish.
role: editor
needs: [S04]
related: [D08, S04]
readMinutes: 2
watchSeconds: 70
video:
  id: VS07
  captions: burned
screens: ["/admin/videos/[id]/preview"]
actions: [video.edit]
aliases: [preview, viewer view, check before publish, test play, what viewers see]
flow: S07
dependsOn: [apps/web/src/app/admin/(shell)/videos/[id]/preview, apps/web/src/components/admin/PreviewPlayer.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Open a video in the preview player, the way a viewer would watch it, even before it is published. You end back on the video screen.

## Before you start
- **Who can do this:** Editors, Admins and Super admins.
- **Time:** about 2 minutes.
- The video must be uploaded. It can be a [draft](glossary:draft).
- To see the whole public site, open the account menu at the top right and choose **Preview site**. It opens the site in a new tab. Close that tab to come back.
- On the practice site that made the video, the link opens a page that says the video is not available, and the preview player cannot load a video. The video shows the page your real site opens. There the video plays.

## Steps
<!-- kb:steps S07 -->
1. Choose **Videos** in the side menu.
<!-- /kb:steps -->

## What you should see
The preview page shows the notice **Only signed in staff can see this preview**, and the player below it. Choose **Back to the video** to return to the video screen. Nothing you watch is saved to anyone's history.

> [!CAREFUL]
> Only signed in staff can open a preview link. If you send the link to a viewer, it will not work for them. To share a video, publish it first.

## If something goes wrong
- **The player does not start.** Check that the video has finished getting ready. Look at the **Encoding** screen. See [Check the Dashboard](help:D01).
- **You see a sign in page.** Your session ended. Sign in again and open the preview again.
