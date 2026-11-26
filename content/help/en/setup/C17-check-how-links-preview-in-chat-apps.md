---
id: C17
title: Check how links preview in chat apps
path: setup
summary: Check the link preview of the platform, a video and a series with share:check and the debuggers.
role: admin
needs: [C15]
related: [C16, R14, T11]
readMinutes: 5
screens: []
aliases: [open graph, og, link preview, facebook debugger, whatsapp preview, linkedin post inspector, share:check, share card, thumbnail in chat, rich results]
dependsOn: [scripts/share-check.ts, apps/web/src/lib/seo/share-check.ts, apps/web/src/lib/seo/metadata.ts]
updated: 2026-11-26
locale: en
status: draft
textOnly: true
---
## What you will do
Check that the platform, one video and one series show the right picture, title and description when a link is pasted into a chat. This guide has no video because the checks run in other tools, not in the admin.

## Before you start
You need the real site address, one published video and one published series. Open **Videos** or **Series** to pick them. The slug is the last part of the public address. Run the command with the developer if you do not use a terminal. [Ask the developer what to send](help:T11)

## Steps
1. Open `https://<site>/title/<video-slug>` in a browser and copy the address of one published video.
2. Open `https://<site>/series/<series-slug>` and copy the address of one published series.
3. Run `pnpm share:check --base https://<site>` from the project folder.
4. Read the table. Every row needs to say it passed, with a picture size of 1200 by 630.
5. Open `https://developers.facebook.com/tools/debug/` and paste `https://<site>/`.
6. Press **Scrape Again** and read the warnings. Do the same for the video and the series address.
7. Open `https://www.linkedin.com/post-inspector/` and inspect the same three addresses.
8. Send each address to yourself in WhatsApp or Telegram and look at the preview card.

## What you should see
`share:check` prints one row per page and ends with no failures. The debuggers show the site name, a clear title, a description and a 1200 by 630 picture. A video card shows the poster and the video title, and a series card shows the series title.

> [!NOTE]
> `pnpm share:check --self-test` checks the rules without any network. `pnpm share:check --base http://localhost:3000 /title/<slug> --private /search` checks a local copy, and `/search` must say it is not for search engines. Telegram and others keep old previews: add `?x=1` to the address to force a fresh look. LinkedIn keeps a preview for about 7 days.

> [!CAREFUL]
> A kids only title must show the generic site card, and an unpublished title must show not found. If either shows the title or the poster, stop and tell the developer.

## If something goes wrong
- **The preview shows the old title or picture.** The chat app saved it. Press **Scrape Again** in the Facebook debugger, or share the link with `?x=1` added. To change the words, open the video and press **Share card**.
- **The picture is missing or the wrong size.** Run `share:check` and read the picture column. Send the table to the developer. [Ask the developer what to send](help:T11)
- **A page says not found.** The title may be unpublished, or donations are switched off. [Publish or unpublish a video](help:D08)
