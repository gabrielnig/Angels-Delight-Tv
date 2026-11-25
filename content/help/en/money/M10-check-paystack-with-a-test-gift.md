---
id: M10
title: Check Paystack with a test gift
path: money
summary: Make a test gift and check it shows with a Test badge.
role: admin
needs: [M07]
related: [M11, M13]
readMinutes: 4
watchSeconds: 90
video:
  id: VM10
screens: ["/admin/donations/[id]"]
actions: [donation.view]
aliases: [paystack, connect paystack, test card, test gift, keys]
flow: M10
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Check that Paystack is connected by looking at a test gift on the Donations screen. You end knowing the link works before real money is involved.

## Before you start
You need to be an Admin. The developer must already have set the Paystack test key on the server and switched donations on. [Set up donations](help:M07)

How the connection is made, in plain words:
1. In your Paystack account the developer finds the **secret key**. There is a test key and a live key.
2. The developer puts the test key in the server settings as `PAYSTACK_SECRET_KEY`. It is shown here as `********` on purpose.
3. The developer also copies the web address for gift confirmations into the Paystack dashboard.
4. You then make one gift on the Donate page using a Paystack test card. The Paystack site lists its test cards.

Never paste a key into this site, a chat or an email. If a key was shared by mistake, ask the developer to replace it.

## Steps
<!-- kb:steps M10 -->
<!-- /kb:steps -->

## What you should see
The test gift shows **Succeeded** and a **Test** badge. The line under the reference says **Receipt queued**. Test gifts are not counted in the totals.

## If something goes wrong
- **No gift appears after the test.** Wait a few minutes. Paystack tells us when it is paid. If it still has not appeared, ask the developer to check the connection.
- **The gift shows **Pending**.** It has not been confirmed yet. [Find gifts with the filters](help:M14)
