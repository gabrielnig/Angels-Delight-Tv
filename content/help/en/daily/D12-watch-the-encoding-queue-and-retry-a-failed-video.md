---
id: D12
title: Watch the Encoding queue and retry a failed video
path: daily
summary: See which videos are getting ready and retry one that failed.
role: editor
needs: [D02]
related: [D02, D07]
readMinutes: 3
watchSeconds: 70
video:
  id: VD12
  phone: true
  captions: burned
screens: ["/admin/encoding", "/admin/encoding/failed"]
actions: [encode.retry, video.edit]
aliases: [encoding, processing, converting, stuck, failed video, retry, queue]
flow: D12
dependsOn: [apps/web/src/components/admin/EncodingQueue.tsx, apps/web/src/components/admin/FailedEncodes.tsx, apps/web/src/app/admin/(shell)/encoding]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Watch the [Encoding](glossary:encoding) queue and retry a video that did not finish getting ready.

## Before you start
- **Who can do this:** Editors, Admins and Super admins.
- **Time:** about 3 minutes.
- Read [Upload one video](help:D02) first.
- A video is not ready to play until it has finished here. A number beside **Encoding** in the side menu shows how many need you.

## Steps
<!-- kb:steps D12 -->
1. Choose **Encoding** in the side menu.
<!-- /kb:steps -->

## What you should see
The video is in the queue again. The page updates by itself, so you do not need to reload it. A failed video that works now moves on and its row says **Processing**.

> [!TIP]
> Choose **Failed encodes** at the top of the page to see every failed video in one list. You can retry or clean up several at once there.

## If something goes wrong
- **A video stays on Processing a long time.** Large files take longer. Wait, and look again after a while.
- **Retry fails again.** Read the reason on the row. If it says the file could not be read, upload the file again from [Upload one video](help:D02).
- **The page says Live updates paused.** Choose **Resume updates**. Updates also pause when you are offline.
