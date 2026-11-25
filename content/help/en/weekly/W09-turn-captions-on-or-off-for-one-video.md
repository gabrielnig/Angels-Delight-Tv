---
id: W09
title: Turn captions on or off for one video
path: weekly
summary: Hide or show the captions button for a single video, or follow the site setting.
role: admin
needs: [D07]
related: [W06, W10]
readMinutes: 2
watchSeconds: 60
video:
  id: VW09
screens: ["/admin/videos/[id]"]
actions: [caption.availability]
aliases: [subtitles off, cc button, hide captions, turn off captions, captions switch]
flow: W09
dependsOn: [apps/web/src/app/admin/(shell)/videos/[id], apps/web/src/components/admin/VideoEditor.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Choose whether viewers can turn [captions](glossary:caption) on for one video. You end with the choice saved, then put back to the site setting.

## Before you start
Only Admins and Super admins can change this. Editors can see the card but it is greyed out. Captions should be [approved](glossary:approved) first, so read [Review and approve captions](help:D07) if you have not.

## Steps
<!-- kb:steps W09 -->
1. Choose **Videos** in the side menu.
2. Click **Washing Hands the Right Way**.
3. Scroll to **Captions for viewers**.
   Only Admins and Super admins can change this card. Editors see it greyed out.
   ![The Captions for viewers card with the On, Off and Follow site default choices marked 1](../../media/W09/W09-03-card-desktop.webp)
4. Select **Off**.
   Off hides the captions button for this video. Viewers who saved a choice keep it for other videos.
5. Click **Save captions setting**.
   ![The Captions for viewers card after saving, with Off chosen and marked 1](../../media/W09/W09-05-saved-desktop.webp)
6. Select **Follow site default (currently on)**.
   Choose this again to put things back. Captions return for viewers.
7. Click **Save captions setting**.
<!-- /kb:steps -->

## What you should see
The **Captions for viewers** card shows your choice. With **Off**, the captions button is gone from the player for this video. With **Follow site default**, the video does what the site setting says.

> [!NOTE]
> Turning captions **Off** only hides the button for this video. The captions are kept, and viewers who saved a captions choice keep it for other videos. Choose **On** to force the button to show, even if the site setting is off.

> [!TIP]
> Most videos should use **Follow site default**. Use **Off** only when the captions are wrong and you need time to fix them.

## If something goes wrong
- **The choices are greyed out.** Your role cannot change this. Ask an Admin or a Super admin to do it.
- **The page says it could not save.** Nothing was changed. Check your connection and click **Save captions setting** again.
