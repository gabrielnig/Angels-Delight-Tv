---
id: W04
title: Arrange the Home rows
path: weekly
summary: Add, rename, reorder and hide the rows viewers see on Home, then publish.
role: editor
needs: [S04]
related: [W05, C05]
readMinutes: 5
watchSeconds: 150
video:
  id: VW04
screens: ["/admin/home"]
actions: [home.curate]
aliases: [home rows, sections, rows, trending, top 10, most liked, popular, view all, curate home, homepage]
flow: W04
dependsOn: [apps/web/src/components/admin/HomeCuration.tsx, apps/web/src/components/admin/HomeSections.tsx, apps/web/src/components/admin/SectionEditor.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Add a section, hide another and publish the new Home page. You end with Home showing the rows you chose.

## Before you start
You need to be an Editor or above. Read [Find your way around](help:S04) if you have not yet. Sections on screen are called rows on the viewer site.

## Steps
<!-- kb:steps W04 -->
1. Click **Home curation** in the side menu.
2. Check the **Sections** list.
   Each section is one row on the viewer Home page, in the order viewers see them. Add section starts a new row: you choose a kind (New, Popular, Trending now, Top 10, Most liked, Category, Series or Manual list) and a name. Trending now, Top 10 and Most liked stay hidden until enough viewers have watched.
   ![The Sections list with the Add section button marked 1](../../media/W04/W04-02-sections-desktop.webp)
3. Click **Edit New this week**.
4. Check the **View all link** choices.
   Automatic opens the matching list page. Custom link uses a path or an https link. None hides the link.
   ![The section editor with the View all link choices marked 1](../../media/W04/W04-04-view-all-desktop.webp)
5. Click **Move New this week down**.
   You can also drag the handle beside a section.
6. Untick **Show My List**.
   A hidden section stays in the list but viewers do not see it. In the section editor, Show on Kids profiles has its own switch.
7. Click **Mobile** in the live preview.
   ![The live preview in phone size marked 1](../../media/W04/W04-07-preview-desktop.webp)
8. Click **Save draft**.
9. Click **Publish changes**.
   Viewers see the new order within a minute. Restore previous undoes the last publish and Restore launch defaults puts back the first layout.
<!-- /kb:steps -->

## What you should see
The message **Home page published.** appears and the bar at the top says **Published and up to date**. The **Live preview** shows the rows in the order viewers see them.

> [!TIP]
> Section kinds: **New** (newest videos), **Popular** (most watched), **Trending now**, **Top 10**, **Most liked**, **Category**, **Series** and **Manual list**. Trending now, Top 10 and Most liked stay hidden from viewers until enough people have watched.

> [!NOTE]
> To change the order, drag the handle beside a section, or click **Move up** and **Move down**. In the section editor you can rename a section, set **Minimum titles to show**, choose **Fall back to newest**, and turn on **Show on Kids profiles**. **Restore launch defaults** puts back the first layout. **Restore previous** undoes the last publish.

## If something goes wrong
- **Publish changes is greyed out.** There is nothing new to publish, or a yellow message names a problem to fix first. Read the message above the lists.
- **A section does not show for viewers.** It may be hidden, or it has fewer titles than its minimum. Check the **Show** switch and **Minimum titles to show**.
- **I cannot add another section.** Home holds at most 12 sections. Hide or remove one first.
