---
id: C12
title: Change a role, remove access, reset two step
path: setup
summary: Change what a team member can do, and reset their two step sign in when they lose their phone.
role: super_admin
needs: [C11]
related: [C11, R02]
readMinutes: 3
watchSeconds: 90
video:
  id: VC12
screens: ["/admin/roles"]
actions: [roles.change, roles.bulk]
aliases: [change role, demote, promote, remove access, lost phone, reset two step]
flow: C12
dependsOn: [apps/web/src/app/admin/(shell)/roles, apps/web/src/components/admin/RolesScreen.tsx]
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Change a team member's [role](glossary:role), and reset their [two step sign in](glossary:two-step-sign-in) when they lose their phone and their [recovery codes](glossary:recovery-code).

## Before you start
Only a Super admin can do this. You cannot change your own role, and the last Super admin is protected so you cannot lock everyone out. Before a reset, check it is really the person, for example by phone or in person.

## Steps
<!-- kb:steps C12 -->
1. Choose **Roles and invites** in the side menu.
   ![The staff list with the Role list of Demo Editor marked 1](../../media/C12/C12-01-staff-desktop.webp)
2. Select **Admin** from the **Role for Demo Editor** list.
   You cannot change your own role, and the last Super admin is protected.
3. Click **Reset two step sign in for Demo Admin**.
   Do this when someone loses their phone and recovery codes. They are signed out and must set up again.
   ![The reset box asking you to confirm](../../media/C12/C12-03-reset-desktop.webp)
<!-- /kb:steps -->

## What you should see
The role list shows the new role straight away. After a reset, the person is signed out everywhere and must set up two step sign in again at their next sign in. They get an email.

> [!NOTE]
> To remove someone's access, change their role to the lowest staff role and ask the developer if the account must be closed. There is no delete button for staff on this page.

> [!CAREFUL]
> A reset removes their authenticator and recovery codes. Use it only when the person cannot sign in any other way.

## If something goes wrong
- **The role list is greyed out.** It is your own row, or the last Super admin. Ask another Super admin.
- **The reset box asks for a code.** Type the code from your own authenticator app to confirm it is you.
