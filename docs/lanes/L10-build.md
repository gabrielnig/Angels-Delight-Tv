# Lane L10 build notes (module M49, account security and reach)

Plan: `docs/plan/v2/L10-account-and-reach.md` (section 12 wins), rulings R24, R30, R31, R38. Worktree `/home/claude/wt2/L10-build`, branch per slice `l10/sN-...`.

## Merged
- S1 (PR 279): `packages/auth/src/mfa-core.ts` (`MfaCore`: verifyCode, recovery codes, lockout, enrolment) shared by `StaffService` and the viewer service. Tests: `mfa-core.int.test.ts` plus the unchanged staff tests.
- S2 (PR 286): `ViewerMfaService` (`viewer-mfa.ts`), `mfa-pending.ts` (signed 10 minute note, not a session), `signIn` returns `mfa_required`, config `viewerMfaEnabled`, eight mail templates and mailer methods (mfa, recovery, viewer reset, new device, Google linked and unlinked). Decision D-271 (check the number on main). Tests: `viewer-mfa.int.test.ts`, `mfa-pending.test.ts`, mailer `templates.test.ts`.

## Merged, continued
- S3 (PR 294): challenge page, gateway, cookie `ad_mv`, env `VIEWER_MFA_ENABLED`.
- S4 (PR 300): Two step verification card (`TwoFactorCard`, `RecoveryCodes`), account repository and actions, admin Reset two step verification on the user page (`resetTwoFactorForUserAction`, `PeopleService.resetViewerTwoFactor`). Test: `account-repo.mfa.test.ts`, `TwoFactorCard.test.tsx`, `RecoveryCodes.test.tsx`, `UserDetail.test.tsx`.
- S5 (viewing activity): `packages/viewer/src/activity.ts` (`listActivity`, `removeActivity`, `clearActivity`), `LibraryRepository.activity, removeActivity, clearActivity`, server actions (not API routes, same guard as other account actions, adults only), `/account/activity`, `ActivityView`, nav link, Data and privacy card (S180), icons tv, tablet, clock, eye. Tests: `activity.int.test.ts`, `ActivityView.test.tsx`, `activity-groups.test.ts`.

- S6 (sign in history, new device mail, sign out everywhere): migration `0047_login_events.sql` (table, RLS owner policy, maintenance policy, `sessions.country`, `sessions.device_hash`), `packages/auth/src/login-events.ts` (record, list, purge, device hash and labels), hooks in `AccountService.signIn` and `ViewerMfaService.openSession` (never block sign in), `RATE_POLICIES.newDeviceMail`, `RequestMeta.country` and `deviceId` (`ad_dev` cookie minted in `requestMeta()`), queue `auth.login_events_prune` (daily 03:45 Lagos, worker `pruneLoginEvents`), `DevicesCard` Sign out everywhere dialog, `LoginHistoryCard`, notice `everywhere`. Decision D-293. Tests: `login-events.int.test.ts`, `signout-everywhere.int.test.ts`, `account-repo.signout.test.ts`, `LoginHistoryCard.test.tsx`, `DevicesPanel.test.tsx`, `request.test.ts`, `maintenance.test.ts`, `prunes.int.test.ts`, queue `definitions.test.ts`. Known unrelated failures on main: `catalog.int.test.ts` publish ("Choose a maturity rating") and `system.int.test.ts` storage.

- S7 (playback settings, L10b): `captionColor` (`white` or `yellow`) in `packages/player/src/captionStyle.ts` (`CAPTION_COLORS`, `captionColorAllowed`; yellow with no background and standard contrast is refused, the normaliser falls back to white), `PlaybackSettings.captionColor`, stored in `profiles.playback_prefs` jsonb (no migration), server refusal in `AccountViewerData.savePlayback`, caption colour row, Reset to defaults (confirm dialog, captions only), profile name heading, Data saver extra line and "This device is on Data saver" note from `navigator.connection.saveData`, copy `account.playback.*`. `captionEdge` already existed. Fixed `catalog.int.test.ts` publish fixture (PR 328): it broke when the maturity gate landed (commit 926eca1, L5), not an L10 change. `system.int.test.ts` passes on a clean main now. Tests: `captionStyle.test.ts`, `PlaybackSettings.test.tsx`, `real-account-data.int.test.ts`.

## Was in PR (slice 3, challenge half)
- Env `VIEWER_MFA_ENABLED`, `RealAuthGateway.verifyTwoStep, verifyRecovery, hasTwoStepPending`, cookie `ad_mv` (`__Host-ad_mv`), `/sign-in/verify` page, `TwoStepForm`, actions `verifyTwoStepAction`, `verifyRecoveryAction`, copy in `packages/shared/src/messages/l10-messages.ts` (spread into `EN_NG`, add all later L10 keys there).

## Not built yet (resume here, in this order)
1. (done, S7)
2. `--font-mono` doc rows in DESIGN-SYSTEM.
3. Google sign in (see plan slice 5 and 6).
4. TV mode.
5. Docs: M49 stories, MODULES, BUILD-PLAN, SCREEN-ARCHITECTURE, SECURITY, CLIENT-INPUTS, not now notes (offline downloads, passkeys), decisions D-L10-03 to D-L10-15.
Owner follow up: the `.claude` skill grep edit for the Google mark (plan 12.2) is not done because the shell must not write there.

## Scoped tests
`pnpm vitest run packages/auth/src/mfa-core.int.test.ts packages/auth/src/viewer-mfa.int.test.ts packages/auth/src/mfa-pending.test.ts packages/mailer/src/templates.test.ts apps/web/src/server/auth/gateway.test.ts apps/web/src/components/auth/TwoStepForm.test.tsx` (int files need `TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres` and `pg_ctlcluster 16 main start`).
