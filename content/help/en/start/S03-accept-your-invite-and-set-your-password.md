---
id: S03
title: Accept your invite and set your password
path: start
summary: Join as staff from your invite email, then set your password and confirm with an emailed code.
role: editor
needs: []
related: [S02, S04]
readMinutes: 2
screens: ["/admin/invite/[token]"]
actions: [admin.access]
aliases: [invite, invitation, join, new account, first time, set password, welcome email]
dependsOn: [apps/web/src/app/admin/invite, apps/web/src/app/admin/login/2fa/EmailCodeForm.tsx]
updated: 2026-11-25
locale: en
status: draft
textOnly: true
---
## What you will do
Accept an invite to join the team. You set a password, enter the code we email you and see the [Dashboard](/admin).

## Before you start
- **Who can do this:** anyone a Super admin has invited.
- **Time:** about 2 minutes.
- You need the invite email. Its subject starts "You are invited to help run". The link works once and lasts 72 hours.
- You need access to the inbox the invite came to.
- This guide has no video and no pictures. The practice site that makes the videos cannot send or open an invite, so every step here is written from the screens in the code.

## Steps
1. Click **Accept the invitation** in the email.
   > [!NOTE]
   > The page says **Accept your invite** and names your role: a content editor, an admin or a Super admin.
2. Type your password in the **Password** box.
   > [!TIP]
   > Use at least 10 characters. Do not use a common password, and do not use your email address.
3. Click **Create account**.
4. Wait until you see **Enter your code**.
   We email a 6 digit code to the same address. It lasts 10 minutes.
5. Type the code in the code box and click **Verify**.
   > [!NOTE]
   > Leave **Remember this device** on for your own device. Untick it on a shared one.

## What you should see
The [Dashboard](glossary:dashboard) opens. From now on you sign in with your email, your password and an emailed code. See [Sign in and set up two step sign in](help:S02).

## If something goes wrong
- **The page says This invite has expired.** Invites last 72 hours and work once. Ask the person who invited you to send a new one.
- **The code has not come or is not accepted.** Check spam, then choose **Email me a new code**. Still stuck? [What to send ARKDEV](help:T11)
