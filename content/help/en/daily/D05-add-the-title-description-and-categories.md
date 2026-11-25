---
id: D05
title: Add the title, description and categories
path: daily
summary: Tell viewers what a video is about and where to find it.
role: editor
needs: [D02]
related: [D02, D07, D08]
readMinutes: 4
watchSeconds: 80
video:
  id: VD05
  phone: true
  captions: burned
screens: ["/admin/videos", "/admin/videos/[id]"]
actions: [video.edit]
aliases: [details, title, description, tags, genre, topic, rating, edit video]
flow: D05
dependsOn: [apps/web/src/components/admin/VideoEditor.tsx, apps/web/src/components/admin/VideosList.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Fill in the details of a video: its description, [categories](glossary:category), tags and [maturity rating](glossary:maturity-rating). You end with the details saved.

## Before you start
- **Who can do this:** Editors, Admins and Super admins.
- **Time:** about 4 minutes.
- The video must already be uploaded. Read [Upload one video](help:D02) first.
- Write a title that says what viewers will learn. Start the description with a verb, such as "Learn" or "See".

## Steps
<!-- kb:steps D05 -->
1. Choose **Videos** in the side menu.
<!-- /kb:steps -->

## What you should see
The message **Changes saved** appears. The card **How viewers see it** shows your title and categories. The checklist **Before you publish** gets shorter.

> [!TIP]
> The **Title** box and **Description** box show a counter. Stay under the limit so the words are not cut off on a phone.

## If something goes wrong
- **Save changes is grey.** Nothing has changed yet. Edit a box and the button turns on.
- **A red message sits under a box.** Read it and fix that box. The page keeps your other changes.
- **You left the page by mistake.** Choose **Discard changes** to go back to the last saved version, or open the video again from Videos.
