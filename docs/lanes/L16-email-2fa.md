# L16 Staff emailed second step

Branch `l16-email-2fa`. Migration 0062. Decisions D-397 to D-399. Earlier PR #483 fixed ReauthRequired handling and the invite mail failure message.

## What exists
- Emailed 6 digit code as the staff second step: 10 minutes, single use, hashed, 5 attempts, 60 second resend cooldown, hourly cap, keyed rate limits. Sent only after a correct password. Code in `packages/auth/src/staff-email-code.ts`, flow in `staff.ts`.
- An enrolled authenticator always wins. Recovery codes exist only with an authenticator. With email off, staff fall back to enrolment, so no sign in without a second step.
- Invite accept ends at the email code step. No forced QR enrolment.
- Site settings group Security: `security.staff_second_step`, `staff_session_idle_days` (7), `staff_session_absolute_days` (30), `trusted_device_days` (30, 0 turns it off).
- Remember this device: table `trusted_devices`, cookie `__Host-ad_td`, hashed token, listed and revocable on My account, cleared by sign out everywhere, password change and role change.
- Sensitive actions accept a fresh email code or the password (ReauthDialog, My account).
- Eye toggle on every password input (`components/PasswordToggle.tsx`) with a scan test.
- Mail templates `staff_sign_in_code` and `staff_confirm_code`.

## L16b: Security section on My account (D-400)
- `StaffService`: `securitySummary`, `sendTestCode`, `confirmTestCode`, `switchToEmailCodes({password,code}|{emailCode})`, `beginAuthenticatorSwitch`, `finishAuthenticatorSwitch`. Mail template `staff_second_step_changed`.
- UI: `components/admin/SecuritySection.tsx` inside `MyAccountView`. Tests: `staff-second-step-switch.int.test.ts`, `SecuritySection.test.tsx`.
- Help: C13 updated, R04 rebuilt by running `pnpm help:settings`. The C13 two step screenshot and video still show the old card heading and need re-recording.

## Scoped tests
- `TEST_DATABASE_ADMIN_URL=... pnpm vitest run packages/auth/src/staff-email-code.int.test.ts packages/auth/src/staff-trusted-device.int.test.ts packages/auth/src/sessions.int.test.ts`
- `pnpm vitest run packages/mailer packages/theme packages/db/src scripts/design-doc-sync.test.ts scripts/kb-recorder/settings-reference.test.ts`
- Web: `EmailCodeForm`, `PasswordToggle`, `password-inputs.scan`, `MyAccountView`, `ReauthDialog`, `SecurityTab`, `cookies`.
- `pnpm help:check`

## Gaps
- Authenticator enrolment on My account exists only as the switch back from emailed codes (L16b, D-400); there is no enrolment for an account that never had a second step other than at sign in.
- Staff mail and admin UI are English only (L7-D5), so no yo, ig or ha drafts were added.
- Delivery of staff code mail is not verified against Brevo.
- Purge relies on the cascade from accounts for `trusted_devices`.
- Unrelated pre-existing failures remain, for example the Chromium file chooser test in `scripts/kb-recorder/fact-run.test.ts`.

## Guides to re-record
Text is updated for all. These videos or screenshots still show the old authenticator step: S02 (VS02, code page), T06 (code page), C12 (reset box shows the authenticator field), C13 (Two step card), K07 (recovery box).
