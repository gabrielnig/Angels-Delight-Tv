# Lane L10 build notes (module M49, account security and reach)

Plan: `docs/plan/v2/L10-account-and-reach.md` (section 12 wins), rulings R24, R30, R31, R38. Worktree `/home/claude/wt2/L10-build`, branch per slice `l10/sN-...`.

## Merged
- S1 (PR 279): `packages/auth/src/mfa-core.ts` (`MfaCore`: verifyCode, recovery codes, lockout, enrolment) shared by `StaffService` and the viewer service. Tests: `mfa-core.int.test.ts` plus the unchanged staff tests.
- S2 (PR 286): `ViewerMfaService` (`viewer-mfa.ts`), `mfa-pending.ts` (signed 10 minute note, not a session), `signIn` returns `mfa_required`, config `viewerMfaEnabled`, eight mail templates and mailer methods (mfa, recovery, viewer reset, new device, Google linked and unlinked). Decision D-271 (check the number on main). Tests: `viewer-mfa.int.test.ts`, `mfa-pending.test.ts`, mailer `templates.test.ts`.

## In PR (slice 3, challenge half)
- Env `VIEWER_MFA_ENABLED`, `RealAuthGateway.verifyTwoStep, verifyRecovery, hasTwoStepPending`, cookie `ad_mv` (`__Host-ad_mv`), `/sign-in/verify` page, `TwoStepForm`, actions `verifyTwoStepAction`, `verifyRecoveryAction`, copy in `packages/shared/src/messages/l10-messages.ts` (spread into `EN_NG`, add all later L10 keys there).

## Not built yet (resume here, in this order)
1. Account side of 2FA: `AccountRepository` methods (`twoFactor`, `beginTwoFactor`, `confirmTwoFactor`, `disableTwoFactor`, `regenerateRecoveryCodes`) in `lib/data/types.ts`, `fixtures/account.ts`, `server/auth/account-repo.ts` (pass `authRuntime().viewerMfa` as a new constructor argument), server actions, `TwoFactorCard`, `TwoFactorEnrol`, `RecoveryCodes`, turn off and new codes dialogs (S171, S172, S181), render in `SecurityView`. Test file idea: `account-repo.mfa.test.ts`.
2. Admin reset button on `apps/web/src/app/admin/users/[id]` calling `ViewerMfaService.adminReset` (Admin role only, reason required).
3. Google sign in (migration for null password hash and `account_identities`, env `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` both or neither, `arctic`, link rules, routes 404 without keys, `GoogleMark.tsx`, DESIGN-SYSTEM 11.26 exception, `link-google` page, connected sign in card). Viewer 2FA must still apply: call `mfaChallenge`.
4. Viewing activity (`packages/viewer/src/activity.ts`, routes, page, nav link, S180 link on Data and privacy).
5. New device email and login events (migration), sign out everywhere button (`AccountService.signOutEverywhere` already exists), login history.
6. Playback settings: `captionEdge` already exists in `PlaybackSettings` on main; add `captionColor`, reset, device note.
7. Icons `tv`, `tablet`, `clock`, `eye` in `components/account/icons.tsx`; `--font-mono` doc (DESIGN-SYSTEM 3.3 and 5), skill grep edit (the shell must not write in `.claude/`, leave to the owner).
8. TV mode (detect, spatial-nav, `/tv`, `tv.css`, device activate as Could).
9. Docs: not now notes for offline downloads and passkeys (R24), USER-STORIES M49 block, MODULES, BUILD-PLAN, SCREEN-ARCHITECTURE, SECURITY, CLIENT-INPUTS, D-L10-03 to D-L10-15 decisions.

## Scoped tests
`pnpm vitest run packages/auth/src/mfa-core.int.test.ts packages/auth/src/viewer-mfa.int.test.ts packages/auth/src/mfa-pending.test.ts packages/mailer/src/templates.test.ts apps/web/src/server/auth/gateway.test.ts apps/web/src/components/auth/TwoStepForm.test.tsx` (int files need `TEST_DATABASE_ADMIN_URL=postgres://postgres:postgres@localhost:5432/postgres` and `pg_ctlcluster 16 main start`).
