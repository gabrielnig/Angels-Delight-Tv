---
id: T17
title: The Cloudflare plan limit sign
path: troubleshooting
summary: Spot the sign that the free Cloudflare plan has run out, and fix it.
role: super_admin
roleNote: The owner needs the Cloudflare account. A Super admin can read the playback figures on System.
related: [T04]
readMinutes: 3
aliases: [cloudflare, plan limit, requests, free plan, videos stop, workers plan, paid plan]
updated: 2026-11-25
locale: en
status: draft
textOnly: true
---
## What you will do
Recognise the sign that the free [Cloudflare](glossary:cloudflare) plan has reached its daily limit, and move to the paid plan. You end with videos playing all day.

## Before you start
You need access to the Cloudflare account, which belongs to the owner. The admin area has no Cloudflare figure, so you read it in the Cloudflare dashboard. The free plan stops at 100,000 requests a day. That is about 1,200 plays, because each play asks for many small pieces. The paid plan costs about 5 USD a month. See [Workers plan](glossary:workers-plan).

## Steps
1. Notice the sign: viewers say videos stop or will not start at about the same time each day, while the pages still open.
2. Ask a viewer for the [reference code](glossary:reference-code) shown under the message, and write down the time.
3. Open **System** and click **Player quality**. Look at **Playback errors** for a code that is high.
4. Sign in to your Cloudflare account in a browser.
5. Open the section for Workers and look at the request figures for today. Ask ARKDEV to show you the right page the first time.
6. Compare the figure with 100,000. If it is near or over, the limit is the cause.
7. Choose the paid Workers plan in the Cloudflare billing area and pay for it.
8. Wait a few minutes, then ask a viewer to play a video again.
9. Tell ARKDEV the plan changed, so it is written in the handover notes.

## What you should see
Videos play at busy times and the request figure can go above 100,000 with no stop. The playback errors on **Player quality** fall back to a low number.

> [!CAREFUL]
> Guest viewing lets anyone with a link start a play, so a shared link can use the daily limit fast. Move to the paid plan before you share a link widely.

## If something goes wrong
- **The figure is far below 100,000 and videos still stop.** The limit is not the cause. [Viewers say a video will not play](help:T04)
- **You cannot see the request figure.** Your Cloudflare role may be too low. Ask the account owner, or ARKDEV, to look with you.
