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

- S8 (PR below in history): DESIGN-SYSTEM 3.3 Type family tokens, Mono family editor row, theme editor Fixed list. Test `scripts/l10-doc-sync.test.ts` (L10 doc checks live here, slice 11 extends it).

- S9 (Google sign in, L10b): migration `0052_account_identities.sql` (table, RLS, `auth_find_identity`, `auth_find_account_for_link`, credentials check relaxed), `packages/auth/src/oauth/` (`google.ts` OIDC client with PKCE and ID token checks, `link-rules.ts`, `note.ts` signed notes, `service.ts` `GoogleAuthService` extending `ViewerMfaService`: `begin`, `complete`, `confirmLink`, `finishSignUp`, `identityStatus`, `unlink`, `peekNote`; `fake-google.ts` test provider), env `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (both or neither), site setting `features.signin_with_google`, `RATE_POLICIES.googleStartIp` and `googleCallbackIp`, web `server/auth/google-flow.ts` (cookies and redirects), `google-runtime.ts`, `google-enabled.ts`, routes `/api/auth/google/start` and `/callback` (404 without keys), pages `/sign-in/link-google`, `/sign-in/google-failed`, `/sign-up/google`, `GoogleButton`, `GoogleMark`, `SocialButtons`, `LinkGoogleForm`, `FinishGoogleSignUp`, `ConnectedSignInCard` on Security, actions in `app/actions-google.ts`. Decisions D-314 to D-316. DESIGN-SYSTEM 11.26 and the skill grep carry the colour exception. Guest import after Google needs nothing extra: `ImportPrompt` runs from `ViewerChrome` on any viewer page. Tests: `oauth/*.test.ts`, `oauth/service.int.test.ts`, `google-flow.test.ts`, `google-enabled.test.ts`, `google-routes.test.ts`, `GoogleButton.test.tsx`, `LinkGoogleForm.test.tsx`, `FinishGoogleSignUp.test.tsx`, `ConnectedSignInCard.test.tsx`. Manual step for launch: create a Google Cloud OAuth client with redirect URI `<APP_ORIGIN>/api/auth/google/callback` and set the two env keys.

## Was in PR (slice 3, challenge half)
- Env `VIEWER_MFA_ENABLED`, `RealAuthGateway.verifyTwoStep, verifyRecovery, hasTwoStepPending`, cookie `ad_mv` (`__Host-ad_mv`), `/sign-in/verify` page, `TwoStepForm`, actions `verifyTwoStepAction`, `verifyRecoveryAction`, copy in `packages/shared/src/messages/l10-messages.ts` (spread into `EN_NG`, add all later L10 keys there).

## Not built yet (resume here, in this order)
1. (done, S7)
2. (done, S8)
3. (done, S9)
4. TV mode.
5. Docs: M49 stories, MODULES, BUILD-PLAN, SCREEN-ARCHITECTURE, SECURITY, CLIENT-INPUTS, not now notes (offline downloads, passkeys), decisions D-L10-03 to D-L10-15.
Owner follow up: the `.claude` skill grep edit for the Google mark (plan 12.2) is not done because the shell must not write there.

## Scoped tests
`pnpm vitest run packages/auth/src/mfa-core.int.test.ts packages/auth/src/viewer-mfa.int.test.ts packages/auth/src/mfa-pending.test.ts packages/mailer/src/templates.test.ts apps/web/src/server/auth/gateway.test.ts apps/web/src/components/auth/TwoStepForm.test.tsx` (int files need `TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres` and `pg_ctlcluster 16 main start`).
