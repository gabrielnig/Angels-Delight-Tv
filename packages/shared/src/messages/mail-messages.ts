/**
 * Copy for the mailer (module M46, slice 17): the viewer facing email templates. Kept in its own file and spread
 * into `EN_NG`. Staff templates stay English because admin screens and staff mail are outside the translation
 * scope (decision L7-D5). Keys follow `mail.<template>.<part>`.
 */
export const MAIL_MESSAGES = {
  'mail.welcome.subject': 'Welcome to {appName}',
  'mail.welcome.intro1': 'Your email is confirmed and your account on {appName} is ready.',
  'mail.welcome.intro2': 'Pick a profile and start watching.',
  'mail.welcome.outro1':
    'You can change your playback and caption settings any time from your account.',
  'mail.welcome.action': 'Start watching',
  'mail.verify_email.subject': 'Confirm your email for {appName}',
  'mail.verify_email.intro1':
    'Enter this code on the verification screen, or use the button below.',
  'mail.verify_email.outro1':
    'The code works for 15 minutes and the button for 24 hours. If you did not create an account, you can ignore this email.',
  'mail.verify_email.action': 'Confirm my email',
  'mail.already_registered.subject': 'Someone tried to sign up to {appName} with your email',
  'mail.already_registered.intro1':
    'Someone tried to create an account on {appName} with this address, but you already have one.',
  'mail.already_registered.intro2':
    'If it was you, sign in instead. If you forgot your password, you can reset it.',
  'mail.already_registered.outro1': 'Forgot your password? Reset it here: {resetUrl}',
  'mail.already_registered.outro2': 'If it was not you, no action is needed.',
  'mail.already_registered.action': 'Sign in',
  'mail.reset_password.subject': 'Reset your {appName} password',
  'mail.reset_password.intro1':
    'We received a request to reset your password. Use the button below to choose a new one.',
  'mail.reset_password.outro1':
    'This link works once and expires in {minutes} minutes. If you did not ask for it, you can ignore this email and your password stays the same.',
  'mail.reset_password.action': 'Choose a new password',
  'mail.password_changed.subject': 'Your {appName} password was changed',
  'mail.password_changed.intro1':
    'The password for your account was just changed. Other devices were signed out.',
  'mail.password_changed.outro1': 'If you did not do this, reset your password now: {resetUrl}',
  'mail.password_changed.action': 'Sign in',
  'mail.lockout_notice.subject': 'There were several failed sign-in attempts on {appName}',
  'mail.lockout_notice.intro1':
    'We saw several failed sign-in attempts on your account, so sign-in is paused for {minutes} minutes.',
  'mail.lockout_notice.intro2':
    'If this was you, wait and try again. If it was not, choose a new password.',
  'mail.lockout_notice.outro1': 'Your current sessions were not signed out.',
  'mail.lockout_notice.action': 'Reset my password',
  'mail.email_change_verify.subject': 'Confirm your new email for {appName}',
  'mail.email_change_verify.intro1':
    'Enter this code in your account settings, or use the button below, to confirm this address.',
  'mail.email_change_verify.outro1':
    'The change applies only after you confirm. If you did not ask for it, ignore this email.',
  'mail.email_change_verify.action': 'Confirm this email',
  'mail.email_change_notice.subject': 'Someone asked to change the email on your {appName} account',
  'mail.email_change_notice.intro1':
    'A request was made to move your account to a different email address. Nothing changes until the new address is confirmed.',
  'mail.email_change_notice.outro1':
    'If this was you, no action is needed. If not, reset your password now.',
  'mail.email_change_notice.action': 'Reset my password',
  'mail.two_factor_reset_viewer.subject':
    'Two step verification was reset on your {appName} account',
  'mail.two_factor_reset_viewer.intro1':
    'An administrator reset two step verification on your account after you asked for help, and signed you out everywhere.',
  'mail.two_factor_reset_viewer.intro2':
    'You can sign in with your password and turn it on again from Security.',
  'mail.two_factor_reset_viewer.outro1':
    'If you did not ask for this, change your password and contact support.',
  'mail.two_factor_reset_viewer.action': 'Sign in',
  'mail.mfa_enabled.subject': 'Two step verification is on for your {appName} account',
  'mail.mfa_enabled.intro1':
    'From now on we will ask for a code from your authenticator app when you sign in.',
  'mail.mfa_enabled.intro2':
    'Keep your backup codes somewhere safe. Each one works once if you lose your phone.',
  'mail.mfa_enabled.outro1':
    'If you did not do this, change your password right away and contact support.',
  'mail.mfa_enabled.action': 'Open Security',
  'mail.mfa_disabled.subject': 'Two step verification was turned off on your {appName} account',
  'mail.mfa_disabled.intro1':
    'Two step verification is now off and your other devices were signed out.',
  'mail.mfa_disabled.intro2': 'You can turn it on again any time from Security.',
  'mail.mfa_disabled.outro1':
    'If you did not do this, change your password right away and contact support.',
  'mail.mfa_disabled.action': 'Open Security',
  'mail.recovery_codes_low.subject': 'You are running low on {appName} backup codes',
  'mail.recovery_codes_low.intro1':
    'You have {remaining} backup codes left. Get a new set before you run out so a lost phone does not lock you out.',
  'mail.recovery_codes_low.outro1': 'Getting new codes makes every old code stop working.',
  'mail.recovery_codes_low.action': 'Get new codes',
  'mail.recovery_code_used.subject': 'A backup code was used to sign in to {appName}',
  'mail.recovery_code_used.intro1':
    'A backup code was just used to sign in to your account. You have {remaining} left.',
  'mail.recovery_code_used.outro1':
    'If this was not you, change your password right away and contact support.',
  'mail.recovery_code_used.action': 'Open Security',
  'mail.staff_sign_in_code.subject': 'Your {appName} staff sign in code',
  'mail.staff_sign_in_code.intro1':
    'Someone entered your password to sign in to the {appName} staff area. Enter this code on the sign in screen to finish.',
  'mail.staff_confirm_code.subject': 'Your {appName} confirmation code',
  'mail.staff_confirm_code.intro1':
    'You asked to confirm a sensitive action in the staff area. Enter this code to continue.',
  'mail.staff_code.where': 'Requested on {time} from {device} near {place}.',
  'mail.staff_code.action': 'Not you? Reset your password',
  'mail.staff_code.expires': 'The code works once and expires in {minutes} minutes.',
  'mail.staff_code.notYou':
    'If this was not you, do not share the code. Reset your password now with the button above, then tell your Super admin.',
  'mail.new_device_sign_in.subject': 'New sign in to your {appName} account',
  'mail.new_device_sign_in.intro1':
    'We saw a sign in from a device we have not seen before: {device}, {country}, {time}.',
  'mail.new_device_sign_in.intro2': 'If this was you, no action is needed.',
  'mail.new_device_sign_in.outro1': 'Sign out everywhere from Security: {signOutUrl}',
  'mail.new_device_sign_in.action': 'Not you? Change your password',
  'mail.google_linked.subject': 'Google was linked to your {appName} account',
  'mail.google_linked.intro1': 'You can now sign in with Google as well as your usual method.',
  'mail.google_linked.outro1':
    'If you did not do this, change your password right away and contact support.',
  'mail.google_linked.action': 'Open Security',
  'mail.google_unlinked.subject': 'Google was removed from your {appName} account',
  'mail.google_unlinked.intro1': 'Google can no longer be used to sign in to your account.',
  'mail.google_unlinked.outro1':
    'If you did not do this, change your password right away and contact support.',
  'mail.google_unlinked.action': 'Open Security',
  'mail.account_deleted.subject': 'Your {appName} account was deleted',
  'mail.account_deleted.intro1':
    'Your account, profiles, watch history and list were deleted and cannot be restored.',
  'mail.account_deleted.intro2': 'Backups are cleared within 14 days.',
  'mail.account_deleted.outro1': 'Thank you for learning with us.',
  'mail.deletion_scheduled.subject': 'Your {appName} account will be deleted on {purgeDate}',
  'mail.deletion_scheduled.intro1':
    'We got your request to delete your account. You were signed out everywhere, and your account will be removed on {purgeDate}, in {days} days.',
  'mail.deletion_scheduled.intro2':
    'To keep it, sign in before then and choose Cancel deletion. Everything comes back as it was.',
  'mail.deletion_scheduled.outro1':
    'After {purgeDate} your profiles, list and watch progress are removed and cannot be restored. If you did not ask for this, sign in and cancel, then change your password.',
  'mail.deletion_scheduled.action': 'Sign in to cancel',
  'mail.export_ready.subject': 'Your {appName} data export is ready',
  'mail.export_ready.intro1':
    'Your file has your account, profiles, My List and watch progress. It never includes your password.',
  'mail.export_ready.outro1':
    'The link works for {hours} hours and needs you to be signed in. If you did not ask for this, change your password.',
  'mail.export_ready.action': 'Download my data',
  'mail.export_failed.subject': 'We could not build your export on {appName}',
  'mail.export_failed.intro1': 'Something went wrong while building your file. Nothing was lost.',
  'mail.export_failed.outro1': 'If it keeps failing, write to us and we will help.',
  'mail.export_failed.action': 'Try again',
  'mail.viewer_digest.subject': {
    one: 'One new thing on {appName} this {period}',
    other: 'New things on {appName} this {period}',
  },
  'mail.viewer_digest.day': 'day',
  'mail.viewer_digest.week': 'week',
  'mail.viewer_digest.daily': 'daily',
  'mail.viewer_digest.weekly': 'weekly',
  'mail.viewer_digest.action': 'See what is new',
  'mail.viewer_digest.outro1':
    'You get this because you chose a {frequency} email in your notification settings on {appName}.',
  'mail.viewer_digest.outro2': 'Stop these emails: {unsubscribeUrl}',
  'mail.common.code': 'Your code: {code}',
  'mail.common.orOpen': 'Or open this link: {url}',
  'mail.common.help': 'Need help? Write to {email}.',
} as const;
