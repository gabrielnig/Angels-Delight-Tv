---
id: W26
title: Set a series maturity rating and apply it to every lesson
path: weekly
summary: Choose the rating for a series and copy it to every lesson in one click.
role: editor
needs: [W01]
related: [W01]
readMinutes: 3
watchSeconds: 90
video:
  id: VW26
screens: ["/admin/series/[id]"]
actions: [series.manage]
aliases: [age rating, suitability, kids safe, rating]
flow: W26
dependsOn: [apps/web/src/components/admin/SeriesEditor.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Set the maturity rating of a series and apply it to all its lessons. You end with one rating on every lesson.

## Before you start
You need the Editor role or above. A series must have a rating before it can be published.

The lessons keep their own rating until you apply the series rating. Applying replaces the rating on every lesson, so you can change single lessons afterwards.

## Steps
<!-- kb:steps W26 -->
1. Choose **Series** in the side menu.
2. Click **Demo series: Genesis** in the list.
3. Check that **Maturity rating (required)** shows a rating.
   ![The Maturity rating list with a rating chosen, marked 1](../../media/W26/W26-03-rating-desktop.webp)
4. Click **Apply to all 5 lessons**.
   ![The box asking to apply the rating to every lesson, marked 1](../../media/W26/W26-04-apply-desktop.webp)
5. Click **Apply to 5 lessons** to confirm.
<!-- /kb:steps -->

## What you should see
A message says **Rating applied to every lesson.** Every lesson in the series shows the same rating.

> [!CAREFUL]
> Applying replaces the rating of every lesson, including ones you set by hand. The box tells you how many differ today.

## If something goes wrong
- **The Apply button is missing.** Save the rating first. The button appears once the saved rating matches the list.
- **A lesson still shows another rating.** It may have been added after you applied. Apply again.
