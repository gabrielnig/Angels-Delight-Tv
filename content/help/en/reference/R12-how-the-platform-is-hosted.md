---
id: R12
title: How the platform is hosted, in plain words
path: reference
summary: Where your videos, accounts and backups live, explained without jargon.
role: editor
related: [R10, R11, R07]
readMinutes: 3
aliases: [hosting, server, where is my site, cloudflare, vps, storage, how it works, infrastructure]
updated: 2026-11-25
locale: en
status: draft
textOnly: true
---
## What you will do
Understand which companies and machines the platform stands on and what each one does. You do not need to do anything.

## Before you start
Think of the platform as a small TV station with four rooms. Each room has one job. The next steps walk through the rooms.

## Steps
1. The front door is your [domain](glossary:domain), the web address people type. It is rented from a registrar and points visitors to the site.
2. The control room is a rented server. It runs the website, the admin area and the tools that prepare videos and captions.
3. The filing room is a database on that server. It holds accounts, settings, titles, captions and what each person has watched.
4. The store room is Cloudflare storage. Your original video files, the prepared copies and the backups sit there, in separate boxes with separate keys.
5. The delivery van is [Cloudflare](glossary:cloudflare) again. It sends each video from a place near the viewer. Video never passes through the server.
6. The safe is the nightly [backup](glossary:backup). Its key is kept away from the server, so a thief cannot read it.
7. The doorbell is the [uptime monitor](glossary:uptime-monitor). A free service checks the site every minute and emails when it does not answer.
8. The post office is the email service. It sends invites and password messages. If it is not set up, they do not arrive. [Emails](help:T15)
9. The accounts for the domain, Cloudflare and the server should be in the owner's name, with ARKDEV added as a member.

## What you should see
You can say where videos are kept, who delivers them, where the backups are and what would stop viewers watching. The most common limit is the daily request limit of the free Cloudflare plan.

## If something goes wrong
- **Videos stop playing for viewers at busy times.** The free Cloudflare plan may have reached its daily limit. [The plan limit sign](help:T17)
- **The site cannot be reached at all.** Check the domain has not ended, then call ARKDEV. [Routine care](help:R11)
