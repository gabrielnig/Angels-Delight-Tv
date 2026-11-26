---
id: M11
title: Test mode and live mode
path: money
summary: Tell test gifts from real gifts and know when to go live.
role: admin
needs: [M10]
related: [M10, M08]
readMinutes: 3
watchSeconds: 120
video:
  id: VM11
screens: ["/admin/donations"]
actions: [donation.view]
aliases: [test mode, live mode, go live, sandbox]
flow: M11
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Learn how to tell a test gift from a real one. You end knowing the difference and how to check it.

## Before you start
You need to be an Admin. Test mode and live mode come from the Paystack key the developer put on the server. A test key makes test gifts. A live key makes real gifts. You do not choose it in this admin area.

In test mode the Donate page says **Test mode. No real money is taken.** Every gift shows a **Test** badge, and none is counted in the totals. When the developer swaps in the live key, new gifts have no Test badge and they do count. Old test gifts stay in the list with their badge.

Go live in this order: test gift, check it here, then the developer swaps in the live key, then make one real small gift and check it.

## Steps
<!-- kb:steps M11 -->
1. Choose **Donations** in the side menu.
2. Check that **Test gifts are not counted.** shows under the totals.
   ![The totals note, marked 1](../../media/M11/M11-02-note-desktop.webp)
3. Select **succeeded** from the **Status** list.
4. Click **Apply**.
   ![The list with a Test badge on every row, marked 1](../../media/M11/M11-04-filtered-desktop.webp)
5. Click **addondemo01**.
6. Check that **Test** shows next to the status.
   ![The Test badge on one gift, marked 1](../../media/M11/M11-06-badge-desktop.webp)
<!-- /kb:steps -->

## What you should see
The list shows a **Test** badge beside the status of each test gift. The note under the totals says **Test gifts are not counted.**

## If something goes wrong
- **Real gifts show a Test badge.** The server may still hold the test key. Ask the developer to check which key is set.
- **The totals are empty.** Only succeeded live gifts count. [See donations and download the list](help:M08) Still stuck? [What to send ARKDEV](help:T11)
