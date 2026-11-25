---
id: S03
title: Accept your invite and set your password
path: start
summary: Join as staff from your invite email, then set your password and code.
role: editor
needs: []
related: [S02, S04]
readMinutes: 2
screens: ["/admin/invite/[token]"]
actions: [admin.access]
aliases: [invite, invitation, join, new account, first time, set password, welcome email]
dependsOn: [apps/web/src/app/admin/invite, apps/web/src/app/admin/login/2fa/EnrolForm.tsx]
updated: 2026-11-25
locale: en
status: draft
textOnly: true
---
## What you will do
Accept an invite to join the team. You set a password, link your authenticator app and see the [Dashboard](/admin).

## Before you start
- **Who can do this:** anyone a Super admin has invited.
- **Time:** about 2 minutes.
- You need the invite email. Its subject starts "You are invited to help run". The link works once and lasts 72 hours.
- You need your phone with an [authenticator app](glossary:authenticator-app).
- This guide has no video and no pictures. The practice site that makes the videos cannot send or open an invite, so every step here is written from the screens in the code.

## Steps
1. Click **Accept the invitation** in the email.
   > [!NOTE]
   > The page says **Accept your invite** and names your role: a content editor, an admin or a Super admin.
2. Type your password in the **Password** box.
   > [!TIP]
   > Use at least 10 characters. Do not use a common password, and do not use your email address.
3. Click **Create account**.
4. Scan the square code with your authenticator app.
   > [!NOTE]
   > If you cannot scan it, the page shows a key under the code. Type that key into your app.
5. Type the 6 digit code from your app in the **6 digit code** box.
6. Click **Confirm and finish**.
7. Write down the recovery codes the page shows.
   > [!CAREFUL]
   > The codes are shown only once. Each one works once if you lose your phone.
8. Click **I have saved them, continue**.

## What you should see
The [Dashboard](glossary:dashboard) opens. From now on you sign in with your email, your password and a code from your app. See [Sign in and set up two step sign in](help:S02).

## If something goes wrong
- **The page says This invite has expired.** Invites last 72 hours and work once. Ask the person who invited you to send a new one.
- **The code is not accepted.** Wait for a new code in your app and type that one.
- **You lost the recovery codes.** You can make new ones later on the **My account** screen.
