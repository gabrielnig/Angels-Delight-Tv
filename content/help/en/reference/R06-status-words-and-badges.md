---
id: R06
title: Status words and badges
path: reference
summary: What every status word on a video, caption, clip and donation means.
role: editor
related: [R01, R03]
readMinutes: 3
screens: []
aliases: [badge, status, state, draft, scheduled, failed, processing, pending, meaning]
dependsOn: [apps/web/src/components/admin/Badge.tsx, apps/web/src/components/admin/DonationsView.tsx, apps/web/src/components/admin/PreviewClipCard.tsx, apps/web/src/lib/admin/help-reference.ts]
updated: 2026-11-25
locale: en
status: draft
textOnly: true
---
## What you will do
Find out what a coloured badge or status word means and what to do about it. The list is made from the words the screens really show, so it cannot drift.

## Before you start
A badge has a colour and a word. Green means done, blue means the site is working on it, amber means a person must do something, and red means it did not finish.

## Steps
<!-- kb:generated R06 -->
1. Video, **Draft**: Not visible to viewers yet. You are still preparing it.
2. Video, **Uploading**: The file is still travelling to the site. Keep the page open.
3. Video, **Processing**: The site is getting the video ready. This takes a few minutes.
4. Video, **Needs captions**: The video is ready but its captions are not approved yet.
5. Video, **Ready**: Everything is done. You can publish it.
6. Video, **Scheduled**: It will go live by itself at the time you chose.
7. Video, **Published**: Viewers can watch it now.
8. Video, **Failed**: Getting the video ready did not finish. Use Retry on Encoding.
9. Encoding stage, **Waiting to start**: The file is in the queue and has not been picked up yet.
10. Encoding stage, **Checking the file**: The site is checking that the file is a good video.
11. Encoding stage, **Making streaming sizes**: The site is making the smaller copies that play on slow connections.
12. Encoding stage, **Final checks**: The last tests before the video is ready.
13. Captions, **None**: No captions yet.
14. Captions, **Generating**: The site is writing the captions. You can leave the page.
15. Captions, **Needs review**: Captions are written. A person must read and approve them.
16. Captions, **Approved**: A person checked the captions. Viewers can see them.
17. Captions, **Failed**: The captions could not be made. Upload a file or use Regenerate.
18. Preview clip, **Not made yet**: No Home preview clip has been made for this video yet.
19. Preview clip, **Queued**: The clip is waiting its turn to be cut.
20. Preview clip, **Ready**: The clip is made and can play on Home.
21. Preview clip, **Failed**: The clip could not be cut. Home shows the poster. Use Retry.
22. Preview clip, **Skipped**: The video did not suit a clip, such as a very short one. Home shows the poster.
23. Donation, **Succeeded**: The gift arrived and was confirmed.
24. Donation, **Pending**: The donor started a gift and the payment service has not answered yet.
25. Donation, **Failed**: The payment did not go through.
26. Donation, **Abandoned**: The donor left before paying.
27. Donation, **Refunded**: The money was sent back to the donor.
28. Donation, **Needs review**: We could not confirm this gift. An Admin must check it.
<!-- /kb:generated -->

## What you should see
You find your word, read what it means and know whether to wait, act or retry.

## If something goes wrong
- **A word is not in the list.** Ask the developer and say which screen it was on. [Glossary](help:R01)
- **A red word stays for a long time.** Use the Retry button on that screen, or the screen map to find where it lives. [Screen map](help:R03)
