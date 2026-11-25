---
id: M08
title: See donations and download the list
path: money
summary: Read the list of gifts and download it as a spreadsheet.
role: admin
needs: [M07]
related: [M09, M14, M15]
readMinutes: 3
watchSeconds: 180
video:
  id: VM08
screens: ["/admin/donations", "/admin/donations/[id]"]
actions: [donation.view, donation.export]
aliases: [gifts list, export donations, csv]
flow: M08
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Open the list of gifts, read the totals, download the list and open one gift. You end with a spreadsheet and a gift on screen.

## Before you start
You need to be an Admin. Emails in the list are masked, for example `d***@example.net`, and donors who asked to stay private show as **Anonymous**. To see a full email, read [Show a donor email and why it is recorded](help:M15).

The totals count only succeeded live gifts, one total for each currency. Test gifts are never counted. Currencies are never added together. The spreadsheet has no card details and no full emails, and downloading it is written to the audit log.

## Steps
<!-- kb:steps M08 -->
<!-- /kb:steps -->

## What you should see
The list shows the newest gifts first with date, reference, donor, amount and status. The download starts as a file called `donations` followed by the date. One gift opens on its own screen with its status and receipt line.

## If something goes wrong
- **The totals say **No succeeded live gifts in this view.**** Only live gifts count. Test gifts and gifts still waiting do not. [Test mode and live mode](help:M11)
- **The list is empty.** Clear the filters. [Find gifts with the filters](help:M14)
