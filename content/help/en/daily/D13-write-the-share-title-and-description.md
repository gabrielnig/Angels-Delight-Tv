---
id: D13
title: Write the share title and description
path: daily
summary: Set the words a chat app shows when someone shares a video or series link.
role: editor
needs: [D05]
related: [C17, R14, D05]
readMinutes: 3
screens: ["/admin/videos/[id]/share", "/admin/series/[id]/share"]
actions: [video.edit]
aliases: [share card, link preview text, whatsapp preview, open graph text, share title]
dependsOn: [apps/web/src/components/admin/ShareCardEditor.tsx, apps/web/src/lib/seo/share-overrides.ts]
updated: 2026-11-26
locale: en
status: draft
textOnly: true
---
## What you will do
Write a short share title and description for one video or series. You end with a saved share card that chat apps use. This guide has no video because the demo site cannot save it.

## Before you start
Editors and above can do this. Add the normal title and description first. [Add the title, description and categories](help:D05)

## Steps
1. Open **Videos** or **Series** in the side menu and open the item.
2. Click **Share card** in the header of the editor.
3. Type a short line in the **Share title** box. Leave it empty to use the normal title.
4. Type a short line in the **Share description** box. Leave it empty to use the normal description.
5. Watch the three preview cards, for WhatsApp, Facebook and X.
6. Click **Save share card**.

## What you should see
The message **Share card saved. Chat apps pick it up the next time the link is shared.** appears. The preview cards show the words you typed.

> [!NOTE]
> Chat apps show only part of the words. WhatsApp shows about 65 characters of title and 120 of description, Facebook 88 and 160, and X 70 and 200. The picture comes from the poster. [Check how links preview](help:C17)

## If something goes wrong
- **The chat app still shows the old words.** Apps keep previews for days. Share the link again with `?x=1` added, or use a debugger. [Check how links preview](help:C17)
- **The text will not save.** It may be too long or hold a dash, emoji or markup. Shorten it and try again. Still stuck? [What to send ARKDEV](help:T11)
