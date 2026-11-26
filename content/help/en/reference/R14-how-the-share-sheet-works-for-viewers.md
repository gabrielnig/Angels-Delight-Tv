---
id: R14
title: How the Share sheet works for viewers
path: reference
summary: What viewers see when they press Share, and what the Start at switch does.
role: editor
related: [C16, W15, C17]
readMinutes: 3
screens: []
aliases: [share sheet, share button, start at, start at time, timestamp, copy link, share a moment]
dependsOn: [apps/web/src/components/share/ShareSheet.tsx, apps/web/src/components/share/share-targets.ts]
updated: 2026-11-26
locale: en
status: draft
textOnly: true
---
## What you will do
Learn what a viewer sees after pressing **Share**, so you can explain it and check it. This guide has no video because it describes the public site, not an admin screen.

## Before you start
Anyone on the team can read this. You choose the options in [Choose which share options show and their order](help:C16).

## Steps
1. Open any video or series page on the public site and press **Share**.
2. Read the list: **Copy link** first, then your options in order, and **More** last when the device has its own share menu.
3. Press **Copy link**. The message **Link copied** appears, and the link is the clean page address.
4. Press an option such as **WhatsApp** to open that app with the title and link ready to send.
5. Open a video with **Watch**, pause at the moment you want, and press **Share**.
6. Turn on the **Start at** switch. It shows the time, for example **Start at 1:25**.
7. Press **Copy link**. The link now ends in `?t=85`, so the friend's video starts at that second.
8. Close the sheet with **Close**, the Escape key or a tap outside it.

## What you should see
On a phone the sheet slides up from the bottom. On a computer it hangs below the **Share** button. The **Start at** switch is off every time the sheet opens, and appears only on a video, never on a series, and only after the video has played past the first second.

> [!NOTE]
> The shared link is always the clean title address, never the watch page. Titles that are only for kids have no **Share** button. Offline, **Copy link**, **Messages** and **More** still work, and the web options say they need a connection.

## If something goes wrong
- **There is no Share button on a title.** The title is kids only or could not be checked. [Make a video safe for kids mode](help:K01)
- **The Start at switch is missing.** It shows only on the watch page of a video, after the start. Press pause past the first second and open **Share** again.
- **The preview in a chat is old.** Chat apps keep previews for days. [Check how links preview](help:C17)
