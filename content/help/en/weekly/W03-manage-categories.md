---
id: W03
title: Manage categories
path: weekly
summary: Add, rename, reorder, hide and delete the categories viewers use to browse.
role: editor
needs: [S04]
related: [W10, W13]
readMinutes: 3
watchSeconds: 121
video:
  id: VW03
screens: ["/admin/categories"]
actions: [category.manage]
aliases: [genres, topics, tags, groups, rows, order, hide]
flow: W03
dependsOn: [apps/web/src/app/admin/(shell)/categories, apps/web/src/components/admin/CategoriesManager.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Keep your [categories](glossary:category) tidy. You end with a new category added, in the right place, with a name you like.

## Before you start
Editors, Admins and Super admins can manage categories. The order on this page is the order viewers see on the home page, so decide where each one belongs.

## Steps
<!-- kb:steps W03 -->
1. Choose **Categories** in the side menu.
   The order here is the order viewers see on the home page.
   ![The Categories page with the Add category button marked 1](../../media/W03/W03-01-list-desktop.webp)
2. Click **Add category**.
3. Type "Demo Study Skills" in the **Name** box.
   Use up to 40 characters. Short names fit best on a phone.
   ![The Add a category box with the Name field marked 1](../../media/W03/W03-03-add-desktop.webp)
4. Click **Save**.
   The new category goes to the end of the list.
5. Click **Move Demo Study Skills up**.
   Each click moves it one place. Use Move down to go the other way.
   ![The category list with the new category moved up and its Move up button marked 1](../../media/W03/W03-05-moved-desktop.webp)
6. Click **Rename Demo Study Skills**.
7. Type " Tips" in the **Name** box.
   The old name is already in the box, so your words are added to the end.
8. Click **Save**.
9. Click **Hide Demo Study Skills Tips**.
   A hidden category stays here with a Hidden badge, but viewers no longer see it.
   ![The category with a Hidden badge, and its Show button marked 1](../../media/W03/W03-09-hidden-desktop.webp)
10. Click **Delete Demo Study Skills Tips**.
   A category that still holds videos cannot be deleted. Hide it instead.
11. Click **Delete category**.
   This cannot be undone.
<!-- /kb:steps -->

## What you should see
The category list with your changes. A hidden category shows a **Hidden** badge. A short message at the bottom of the screen confirms each change, for example "Category added."

> [!TIP]
> Hide a category when you are not ready to show it, or when you want to keep it for later. Hiding does not delete anything, and you can choose **Show** at any time.

> [!CAREFUL]
> Delete cannot be undone. A category that still holds videos cannot be deleted, and the box tells you how many videos use it. Hide it, or move its videos first.

## If something goes wrong
- **The buttons are greyed out.** Your role cannot manage categories, or a change is still saving. Wait a moment, then try again.
- **The box says the name is not allowed.** Names must not be empty or repeat another category. Choose a different name.
- **The delete box says videos still use it.** Open each video and change its category, or choose **Hide** instead.
