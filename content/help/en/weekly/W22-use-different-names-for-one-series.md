---
id: W22
title: Use different names for one series
path: weekly
summary: Give one series its own words for groups and items instead of the site words.
role: editor
needs: [W21]
related: [W21, W20, W01]
readMinutes: 2
watchSeconds: 60
video:
  id: VW22
screens: ["/admin/series/[id]"]
actions: [series.manage]
aliases: [override, custom words, rename lessons]
flow: W22
dependsOn: [apps/web/src/components/admin/SeriesEditor.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Let one series use different words from the rest of the site. You end with that series reading, for example, Module and Lesson while other series keep the site words.

## Before you start
You need the Editor role or above. Know the site words first: [Choose the series names for your whole site](help:W21).

## Steps
<!-- kb:steps W22 -->
1. Choose **Series** in the side menu.
2. Click **Maths Made Simple** in the list.
3. Scroll to **Names for groups and items**.
4. Click **Use names for this series only**.
   ![The series names section with Use names for this series only chosen, marked 1](../../media/W22/W22-04-own-names-desktop.webp)
5. Select **Module and Lesson** from the **Name set** list.
6. Click **Save names**.
<!-- /kb:steps -->

## What you should see
A message says **Series names saved.** The lists and buttons on this page use the new words. To go back, choose **Use the site names** and click **Save names**.

## If something goes wrong
- **The names do not save.** A custom word may be empty or too long. Fix the field marked in red.
- **Viewers still see the old words.** Reload their page. The change is saved on the series, not on single videos. Still stuck? [What to send ARKDEV](help:T11)
