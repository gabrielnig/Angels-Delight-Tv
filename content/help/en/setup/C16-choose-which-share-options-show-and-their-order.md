---
id: C16
title: Choose which share options show and their order
path: setup
summary: Turn share options on or off and move them up or down in the Share sheet.
role: admin
needs: [C05]
related: [C15, R14, W15]
readMinutes: 3
watchSeconds: 60
video:
  id: VC16
actions: [settings.site]
aliases: [share order, share buttons, whatsapp first, telegram, sms, messages, share channels, move up, move down]
flow: C16
dependsOn: [apps/web/src/components/admin/site/DiscoveryTab.tsx, packages/theme/src/settings-discovery.ts]
updated: 2026-11-26
locale: en
status: draft
---
## What you will do
Choose which options viewers see in the Share sheet and put them in the order you want. You end with the **Discovery** tab saved.

## Before you start
You need to be an Admin or a Super admin. The options are on the same **Discovery** tab as the storage notice in [Storage notice and sharing options](help:C15). To see what viewers get, read [How the Share sheet works for viewers](help:R14).

## Steps
<!-- kb:steps C16 -->
1. Click **Site settings** in the side menu.
<!-- /kb:steps -->

## What you should see
The message **Discovery settings saved. They apply within 5 minutes.** appears. The Share sheet on the site lists the options you left on, in the order of the rows. The setting behind this list is called `seo.share_channels`.

> [!NOTE]
> **Copy link** is always first and the device share menu (**More**) is always last, so neither has a row here. The six options are **WhatsApp**, **Facebook**, **X**, **Telegram**, **Email** and **Messages (SMS)**. A switched off option has no Up or Down button.

## If something goes wrong
- **Up or Down is greyed out.** The row is already first or last. Move the other rows instead.
- **The order did not change on the site.** Changes apply within 5 minutes. Reload the page after that wait.
- **An option is missing from the Share sheet.** Its switch is off, or the device cannot use it. [Share sheet for viewers](help:R14)
