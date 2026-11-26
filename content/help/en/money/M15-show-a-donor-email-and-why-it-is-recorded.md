---
id: M15
title: Show a donor email and why it is recorded
path: money
summary: Show one donor full email, knowing the view is kept in the audit log.
role: admin
needs: [M08]
related: [M09, M08]
readMinutes: 3
watchSeconds: 70
video:
  id: VM15
screens: ["/admin/donations/[id]"]
actions: [donation.view]
aliases: [reveal email, masked email, donor privacy, audit log]
flow: M15
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Show the full email of one donor. You end with the email on screen and a record that you looked.

## Before you start
You need to be an Admin. Emails are masked everywhere by default, for example `d***@example.net`, to protect donors. Show the full email only when you have a real reason, such as helping a donor with a receipt.

Every time you click **Show full email**, a line is added to the audit log with your name and the gift. The email itself is not copied into the log. Do not copy emails into chats or documents.

## Steps
<!-- kb:steps M15 -->
1. Choose **Donations** in the side menu.
2. Click **addondemo01**.
   ![A gift with the email masked and Show full email marked 1](../../media/M15/M15-02-masked-desktop.webp)
3. Click **Show full email**.
   > [!CAREFUL]
   > This view is written to the audit log. Show an email only when you need it.
4. Check that **This view was recorded in the audit log.** shows under the email.
   ![The full email with the audit note marked 1](../../media/M15/M15-04-shown-desktop.webp)
<!-- /kb:steps -->

## What you should see
The full email appears in place of the button, with the line **This view was recorded in the audit log.**

## If something goes wrong
- **The button says you cannot do this.** Only Admins and Super admins can show an email.
- **You showed the wrong email.** The view is already recorded. Tell the Super admin if it matters.
