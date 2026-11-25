---
id: T09
title: A donation is missing or still pending
path: troubleshooting
summary: Check a gift on Donations and settle it only with proof.
role: admin
related: [T11]
readMinutes: 3
screens: ["/admin/donations/[id]"]
actions: [donation.view, donation.resolve]
aliases: [gift, payment, paystack, pending, needs review, missing donation, refund]
dependsOn: [apps/web/src/components/admin/DonationsView.tsx, apps/web/src/components/admin/DonationReviewPanel.tsx]
updated: 2026-11-25
locale: en
status: draft
textOnly: true
---
## What you will do
Find a [donation](glossary:donation) a donor says they made, read its status and settle it if it needs review. You end knowing whether the gift arrived.

## Before you start
You need the Admin role or above. Ask the donor for the date and amount, and for the payment reference they were given. Have your Paystack dashboard open so you can check proof of payment there. Test gifts are marked as test.

## Steps
1. Click **Donations** in the side menu.
2. Find the gift by its date and amount in the list.
3. Check the status badge. **Succeeded** means the gift arrived and was confirmed.
4. If it says **Pending**, wait a few minutes. The payment service has not answered yet.
5. If it says **Abandoned**, the donor left before paying. Ask them to try again.
6. If it says **Needs review**, click the reference to open the gift.
7. Open the same payment in your Paystack dashboard and check it says paid.
8. Type what you checked in the **Note** box. Both buttons stay off until you write a note.
9. Click **Accept the gift** if Paystack shows the money, or **Reject the gift** if it does not.

## What you should see
The gift shows **Succeeded** after you accept it, or stays out of the totals after you reject it. Your note is kept with the gift and in the audit log.

> [!CAREFUL]
> Settle a gift only with proof from Paystack. Accepting a gift that was not paid puts a wrong figure in your totals.

## If something goes wrong
- **The gift is not in the list at all.** The donor may not have finished paying. Check Paystack, then ask the donor for the reference.
- **Pending for a long time.** Wait an hour and open the gift again. If it still says **Pending**, ask the developer.
- **You cannot see Donations.** The screen needs the Admin role. [Roles and permissions](help:R02)
