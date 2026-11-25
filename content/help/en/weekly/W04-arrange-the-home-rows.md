---
id: W04
title: Arrange the Home rows
path: weekly
summary: Reorder the sections on Home, check the phone view and publish your changes.
role: editor
needs: [S04]
related: [W05, W10]
readMinutes: 4
watchSeconds: 80
video:
  id: VW04
screens: ["/admin/home"]
actions: [home.curate]
aliases: [home page, rows, sections, order, curate, landing]
flow: W04
dependsOn: [apps/web/src/app/admin/(shell)/home, apps/web/src/components/admin/HomeCuration.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Change the order of the rows on the Home page, check how it looks on a phone, then publish it. Each row is called a [section](glossary:section).

## Before you start
Editors, Admins and Super admins can do this. Nothing is shown to viewers until you click **Publish changes**, so you can try things safely. See [Home curation](glossary:home-curation) for the words used here.

## Steps
<!-- kb:steps W04 -->
1. Choose **Home curation** in the side menu.
   Rows on Home are called sections.
   ![The Home curation page with the Sections list marked 1](../../media/W04/W04-01-home-desktop.webp)
2. Click **Move New this week up**.
   Each click moves a section one place. The preview on the right updates.
   ![The sections list with Move up marked 1](../../media/W04/W04-02-moved-desktop.webp)
3. Click **Mobile**.
   Check both sizes. Most viewers use a phone.
4. Click **Desktop**.
5. Click **Save draft**.
   A draft is saved for you. Viewers do not see it yet.
6. Click **Publish changes**.
   If you do not like the result, use Restore previous to go back.
   ![The Publish changes button marked 1](../../media/W04/W04-06-publish-desktop.webp)
<!-- /kb:steps -->

## What you should see
The sections in their new order, and a message that your changes are published. Viewers see the new order the next time they open Home.

> [!NOTE]
> Other things you can do here. **Rename** a section, show or hide it with **Show** or **Hide**, or choose **Add section** to add a row such as Trending now. **Kids view** previews what a kids profile sees.

> [!NOTE]
> A row of the type Trending now or Top 10 only shows when it has enough titles. It never borrows from other rows, so a quiet week can hide it.

> [!TIP]
> Put what you want people to start with in the first two sections. Most people never scroll far.

## If something goes wrong
- **You published and do not like it.** Click **Restore previous**. Home goes back to the version before your last publish.
- **You want the starting layout again.** Click **Restore launch defaults**. Your videos stay in the library. Nothing changes for viewers until you publish.
- **A section looks empty in the preview.** It has no titles yet, so viewers will not see it. Add titles or hide it.
