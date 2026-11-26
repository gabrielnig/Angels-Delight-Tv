---
id: C06
title: Edit the legal and About pages
path: setup
summary: Replace the placeholder Terms, Privacy and About text and save it as a new version.
role: admin
needs: [C01]
related: [C01, C05, C10]
readMinutes: 4
watchSeconds: 70
video:
  id: VC06
screens: ["/admin/site-settings"]
actions: [settings.site]
aliases: [terms, privacy, about, legal pages, versions, restore version, page editor]
flow: C06
dependsOn: [apps/web/src/components/admin/site/PagesEditor.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Edit one of the three public pages and publish it. You end with a new live version that you can restore later.

## Before you start
You need to be an Admin or a Super admin. Have the real text ready from your lawyer or organisation. Read [Platform details and the Launch checklist](help:C01) if you have not yet.

## Steps
<!-- kb:steps C06 -->
1. Click **Site settings** in the side menu.
2. Click **Pages** at the top.
   ![The Pages tab with the placeholder warning marked 1](../../media/C06/C06-02-pages-desktop.webp)
3. Check the **Placeholder text.** warning.
   The Terms page and Privacy page start with placeholder text. Replace it before you launch.
4. Click **Bulleted list** in the formatting bar.
   The bar also has Bold, Italic, Heading and Link. Select text first, then click the tool.
5. Click **Preview** to see what viewers will read.
   ![The page preview with the Edit button marked 1](../../media/C06/C06-05-preview-desktop.webp)
6. Click **Edit** to go back to the text.
7. Click **Save draft**.
   A draft is only for you. Viewers keep seeing the live version.
8. Click **Save new version** to publish it.
   Each save makes a numbered version. The newest one is live.
   ![The Versions list with the live version marked 1](../../media/C06/C06-08-versions-desktop.webp)
<!-- /kb:steps -->

## What you should see
The **Versions** list shows a new version at the top marked **(live)**. On the **Launch checklist** in [Platform details and the Launch checklist](help:C01), the **Terms page** or **Privacy page** line says **Published** once the placeholder text is gone.

> [!TIP]
> To go back to an older text, click **Restore** beside an older version. This copies it into your draft. Viewers keep the live version until you click **Save new version**.

> [!NOTE]
> The page buttons are **Terms**, **Privacy** and **About**. The editor accepts headings, paragraphs, lists and links only. Anything else is removed when you save.

## If something goes wrong
- **Save new version is greyed out.** You have not edited the page yet. Change the text first.
- **My formatting disappeared.** The editor keeps only headings, paragraphs, lists and links. Use those instead.
- **The checklist still shows placeholder text.** The page still contains the sample words. Replace all of them, then save a new version. Still stuck? [What to send ARKDEV](help:T11)
