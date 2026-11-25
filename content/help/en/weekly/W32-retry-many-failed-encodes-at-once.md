---
id: W32
title: Retry many failed encodes at once
path: weekly
summary: Select failed videos in the Encoding queue and retry them together.
role: editor
needs: [S04]
related: [T01]
readMinutes: 2
watchSeconds: 75
video:
  id: VW32
screens: ["/admin/encoding"]
aliases: [bulk retry, retry all, processing failed]
flow: W32
dependsOn: [apps/web/src/components/admin/EncodingQueue.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Retry several [encodes](glossary:encoding) that failed. You end with the failed videos back in the queue.

## Before you start
You need the Editor role or above. Read Watch the Encoding queue and retry a failed video first.

The bar button shows how many, for example **Retry 1 failed**. A box asks you to confirm.

## Steps
<!-- kb:steps W32 -->
<!-- /kb:steps -->

## What you should see
The failed videos move back to waiting or encoding, and a message says how many were retried.

> [!NOTE]
> If a video fails again, read its reason before retrying a third time. [A video is stuck on Encoding](help:T01)

## If something goes wrong
- **There is no Retry button.** No failed row is ticked. Tick a failed row first.
- **It fails again.** The file may be damaged. Upload it again.
