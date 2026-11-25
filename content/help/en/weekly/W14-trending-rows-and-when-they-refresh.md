---
id: W14
title: Trending rows and when they refresh
path: weekly
summary: Learn why Trending and Top 10 rows can be missing and when they update.
role: editor
needs: [W04]
related: [W04, C14, W10]
readMinutes: 3
screens: ["/admin/home"]
actions: [home.curate]
aliases: [trending, top 10, popular row, row missing, hidden row, refresh]
dependsOn: [apps/web/src/lib/data/admin/home-rules.ts, apps/web/src/components/admin/SystemView.tsx]
updated: 2026-11-25
locale: en
status: draft
textOnly: true
---
## What you will do
Understand the [Trending](glossary:trending) and Top 10 rows on Home, so you know why one may be missing and when it will come back.

## Before you start
Editors, Admins and Super admins can add these rows. Read [Arrange the Home rows](help:W04) first. The System page tells you when Trending last updated, and [System](help:C14) explains that page.

## Steps
1. Choose **Home curation** in the side menu.
2. Click **Add section**.
3. Choose **Trending now** as the kind of section.
4. Click **Save draft**.

## What you should see
The row appears in the preview. Trending shows only titles that people have watched. If too few titles qualify, the row is hidden from viewers, and it never borrows titles from other rows.

> [!NOTE]
> Trending and Top 10 update by themselves once an hour, at 10 minutes past, Lagos time. A new view can take up to an hour to show in the row.

> [!NOTE]
> A Super admin can see when Trending last refreshed on the System page. If it is older than 3 hours, Trending and Top 10 are hidden from viewers until the next refresh works.

> [!TIP]
> A new site has no views yet, so Trending stays empty at first. That is normal. Keep a **New this week** row near the top meanwhile.

## If something goes wrong
- **The row is missing for viewers.** Too few titles have views. Wait for more viewing, or lower the minimum titles for that section.
- **The System page says Trending has not been refreshed yet.** The first refresh has not run. Wait up to an hour, then tell the developer if it stays empty.
- **The refresh is older than 3 hours.** Ask the developer to check the refresh job. [System](help:C14)
