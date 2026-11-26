---
id: C01
title: Platform details and the Launch checklist
path: setup
summary: Set your site name, tagline, support email and domain, and clear the Launch checklist.
role: admin
needs: [S04]
related: [C02, C05, C06]
readMinutes: 4
watchSeconds: 90
video:
  id: VC01
screens: ["/admin/site-settings"]
actions: [settings.site]
aliases: [site name, branding, tagline, footer, domain, support email, launch checklist]
flow: C01
dependsOn: [apps/web/src/components/admin/site/SiteSettingsView.tsx, packages/theme/src/settings-registry.ts]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Fill in the basic details of your site and check the Launch checklist. You end with the checklist showing fewer items not set.

## Before you start
You need to be an Admin or a Super admin. Have your tagline, support email and domain ready. Read [Find your way around](help:S04) if you have not yet.

## Steps
<!-- kb:steps C01 -->
1. Click **Site settings** in the side menu.
   Admins and Super admins can open this screen. Editors do not see it.
   ![Site settings with the Launch checklist marked 1](../../media/C01/C01-01-site-settings-desktop.webp)
2. Check the **Launch checklist** on the right.
   Each line with a warning sign is something still to set before you launch.
3. Type "Free lessons for every home" in the **Tagline** box.
4. Type "help@example.org" in the **Support email** box.
   Viewers use this address to reach you. Use an address that someone reads every day.
5. Type "lessons.example.org" in the **Domain** box.
   Type the web address without https://. Your developer connects the domain itself.
   ![Platform details with the Tagline, Support email and Domain boxes filled in](../../media/C01/C01-05-details-filled-desktop.webp)
6. Click **Save changes** to keep your edits.
7. Check the **Launch checklist** again.
   The items you filled in now say Done.
   ![The Launch checklist with fewer items not set](../../media/C01/C01-07-checklist-updated-desktop.webp)
<!-- /kb:steps -->

## What you should see
The message **Settings saved.** appears. On the **Launch checklist**, the tagline, support email and domain lines say **Done**. The **Terms page** and **Privacy page** lines stay open until you edit those pages in [Edit the legal and About pages](help:C06).

> [!TIP]
> The other boxes on this tab are the **Platform name**, **Footer text**, **Default language** and **Social links**. Each one is explained in the [settings dictionary](help:R04).

## If something goes wrong
- **The Domain box shows a red message.** Type only the web address, for example lessons.example.org, without https://.
- **Save changes is greyed out.** You have not changed anything yet. Edit a box first.
- **You cannot see Site settings in the menu.** Your role is Editor. Ask an Admin to make the change. Still stuck? [What to send ARKDEV](help:T11)
