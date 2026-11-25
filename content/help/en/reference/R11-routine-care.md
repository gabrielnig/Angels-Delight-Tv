---
id: R11
title: Routine care for the platform
path: reference
summary: The regular checks that keep the site safe: backups, uptime, renewals and staff.
role: editor
roleNote: Checks 1 to 4 are for the owner. Anyone can read them.
related: [R07, R10, R12]
readMinutes: 4
aliases: [maintenance, backups, uptime, renew domain, cloudflare plan, staff accounts, routine]
updated: 2026-11-25
locale: en
status: draft
textOnly: true
---
## What you will do
Learn the five regular checks that keep the site safe and online, how often to do each and how you would know something is wrong.

## Before you start
Know who owns each account. The domain, [Cloudflare](glossary:cloudflare), the server and the email service belong to the owner. ARKDEV is added as a member. [Who does what](help:R10)

## Steps
1. Backups, every month: ask ARKDEV for the date of the last good [backup](glossary:backup). One is made every night.
2. Backups, once: ask ARKDEV to show a restore into a test copy. The admin area has no backup screen.
3. Uptime monitor, every week: look for alert emails from the [uptime monitor](glossary:uptime-monitor). It checks every minute.
4. Uptime monitor, after any change of email: make sure the alert address is one you read.
5. Domain, every year: renew the [domain](glossary:domain) a month before it ends. Put the date in your calendar. If it ends, the site goes offline.
6. Cloudflare plan, every month: check the daily request figure in the Cloudflare dashboard. The free plan stops at 100,000 requests a day, about 1,200 plays.
7. Cloudflare plan, before a launch or a big share: move to the paid plan, about 5 USD a month.
8. Staff accounts, every month: open **Roles and invites** and remove anyone who has left. Give each person the lowest role they need.
9. Staff accounts, after someone leaves: use **Suspend account** on the person page if you are not sure, and tell ARKDEV.
10. Storage, every month: open **System** and read the **Storage** tab. Empty **Trash** and remove test videos when space is short.

## What you should see
Every check has a date in your calendar and a person who does it. You can name the last backup, the next renewal and the plan you are on.

## If something goes wrong
- **Viewers lose video around the same time each day.** This is the plan limit sign. [How the site is hosted](help:R12)
- **The site is down and no alert came.** Call ARKDEV at once. The alert address may be wrong or the monitor may have stopped.
