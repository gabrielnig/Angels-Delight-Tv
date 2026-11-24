/**
 * Copy for lane L10 (module M49): account security, activity and reach. Kept in its own file and spread into
 * `EN_NG` so the lane adds keys without touching the main catalog. Keys follow `area.kind.name`.
 */
export const L10_MESSAGES = {
  // Two step sign in challenge (M49-S02, S03)
  'auth.twoStep.title': 'Enter your code',
  'auth.twoStep.lead': 'Open your authenticator app and enter the 6 digit code for this account.',
  'auth.twoStep.codeLabel': '6 digit code',
  'auth.twoStep.wrong': 'That code is not right. Check the time on your phone and try again.',
  'auth.twoStep.locked': 'Too many wrong codes. Try again in {wait}.',
  'auth.twoStep.expired': 'This sign in took too long. Start again to get a new code step.',
  'auth.twoStep.expiredAction': 'Back to sign in',
  'auth.twoStep.network': 'We could not reach the server. Check your connection and try again.',
  'auth.twoStep.useRecovery': 'Use a recovery code',
  'auth.twoStep.useApp': 'Use my authenticator app',
  'auth.twoStep.recoveryLabel': 'Recovery code',
  'auth.twoStep.recoveryHint':
    'Each recovery code works once. Letters can be any case and the dash is optional.',
  'auth.twoStep.recoveryWrong': 'That recovery code is not right or was already used.',
  'auth.twoStep.recoverySubmit': 'Sign in',
  'auth.twoStep.lost': 'Lost your phone? Contact support.',
  'auth.twoStep.lostWith': 'Lost your phone? Email {email}.',

  // Two step verification on the Security screen (M49-S01, S03, S04)
  'account.twoStep.title': 'Two step verification',
  'account.twoStep.offLead':
    'Ask for a code from an authenticator app when you sign in, so a stolen password is not enough.',
  'account.twoStep.turnOn': 'Turn on',
  'account.twoStep.onBadge': 'On',
  'account.twoStep.codesLeft': {
    one: '{count} backup code left',
    other: '{count} backup codes left',
  },
  'account.twoStep.noCodes': 'No backup codes left',
  'account.twoStep.lowWarning':
    'You are running low on backup codes. Get new ones before you need them.',
  'account.twoStep.newCodes': 'Get new codes',
  'account.twoStep.turnOff': 'Turn off',
  'account.twoStep.setupScan': 'Scan this picture with your authenticator app.',
  'account.twoStep.qrAlt': 'QR code for your authenticator app',
  'account.twoStep.manualKey': 'Or type this key into the app',
  'account.twoStep.codeLabel': 'Enter the 6 digit code from the app',
  'account.twoStep.confirm': 'Confirm and turn on',
  'account.twoStep.cancel': 'Cancel',
  'account.twoStep.wrongCode':
    'That code is not right. Check the time on your phone and try again.',
  'account.twoStep.locked': 'Too many wrong codes. Try again in {wait}.',
  'account.twoStep.network': 'We could not reach the server. Check your connection and try again.',
  'account.twoStep.codesTitle': 'Your backup codes',
  'account.twoStep.codesLead':
    'Each code works once if you lose your phone. They are shown only now.',
  'account.twoStep.copy': 'Copy codes',
  'account.twoStep.copied': 'Codes copied',
  'account.twoStep.download': 'Download codes',
  'account.twoStep.saved': 'I saved these codes',
  'account.twoStep.done': 'Done',
  'account.twoStep.turnOffTitle': 'Turn off two step verification?',
  'account.twoStep.turnOffLead':
    'Enter your password and a current code. We will sign you out on your other devices.',
  'account.twoStep.passwordLabel': 'Your password',
  'account.twoStep.anyCodeLabel': 'Authenticator code or backup code',
  'account.twoStep.wrongPassword': 'That password is not right.',
  'account.twoStep.newCodesTitle': 'Get new backup codes?',
  'account.twoStep.newCodesLead': 'Every old code stops working. Enter your password to continue.',
  'account.twoStep.offDone': 'Two step verification is off.',
  'account.twoStep.onDone': 'Two step verification is on.',

  // Viewing activity (M49-S09, S10)
  'account.activity.title': 'Viewing activity',
  'account.activity.lead': 'See what each profile has watched, remove a title, or clear the list.',
  'account.activity.error': 'We could not load your viewing activity',
  'account.activity.tabsLabel': 'Profile',
  'account.activity.empty': 'Nothing here yet. Titles you watch will show up here.',
  'account.activity.browse': 'Browse titles',
  'account.activity.remove': 'Remove',
  'account.activity.removeLabel': 'Remove {title} from viewing activity',
  'account.activity.removed': '{title} was removed.',
  'account.activity.undo': 'Undo',
  'account.activity.removeFailed': 'We could not remove that title. It is back in the list.',
  'account.activity.loadFailed': 'We could not load this list.',
  'account.activity.retry': 'Try again',
  'account.activity.more': 'Show more',
  'account.activity.clear': 'Clear activity',
  'account.activity.clearTitle': 'Clear activity for {name}?',
  'account.activity.clearLead':
    "This removes every title from this profile's list and from Continue learning. Clearing activity does not delete your account.",
  'account.activity.clearCancel': 'Cancel',
  'account.activity.clearDone': 'Activity cleared.',
  'account.activity.clearFailed': 'We could not clear the list. Nothing was changed.',
  'account.activity.download': 'Download my data first',
  'account.activity.progress': '{pct}% watched',
  'account.data.activityTitle': 'Viewing activity',
  'account.data.activityLead':
    'See what each profile has watched, remove a title, or clear the list. Clearing your viewing activity does not delete your account.',
  'account.data.activityOpen': 'Open viewing activity',
  'account.nav.activity': 'Viewing activity',
  'auth.notice.everywhere': 'You were signed out on every device. Sign in again to continue.',
  'account.devices.everywhere': 'Sign out everywhere',
  'account.devices.everywhereTitle': 'Sign out everywhere?',
  'account.devices.everywhereLead':
    'This signs you out on every device, including this one. Enter your password to confirm.',
  'account.devices.passwordLabel': 'Your password',
  'account.devices.wrongPassword': 'That password is not right.',
  'account.devices.locked': 'Too many tries. Try again in {minutes} minutes.',
  'account.devices.failed': 'We could not sign you out everywhere. Try again.',
  'account.history.title': 'Recent sign ins',
  'account.history.lead':
    'The last 20 attempts in the past 90 days. We keep the country only, never an address.',
  'account.history.empty': 'No sign ins recorded yet.',
  'account.history.success': 'Signed in',
  'account.history.failed': 'Wrong password',
  'account.history.mfaFailed': 'Wrong code',
  'account.history.locked': 'Blocked after too many tries',
  'account.history.newDevice': 'New device',

  // Playback settings (M49-S11)
  'account.playback.heading': 'Settings for {name}',
  'account.playback.saverExtra': 'Data saver also means fewer Home previews and a slower hero.',
  'account.playback.saverDevice': 'This device is on Data saver',
  'account.playback.saverDeviceHint':
    'Your browser asked for less data. That applies on this device whatever your profile says.',
  'account.playback.colour': 'Caption colour',
  'account.playback.colourHint': 'White is easiest on most pictures.',
  'account.playback.colourWhite': 'White',
  'account.playback.colourYellow': 'Yellow',
  'account.playback.yellowRefused': 'Yellow needs a dark or solid background, or high contrast.',
  'account.playback.reset': 'Reset to defaults',
  'account.playback.resetTitle': 'Reset caption settings?',
  'account.playback.resetLead':
    'Size, background, edge, colour and contrast go back to the defaults. Your other settings stay as they are.',
  'account.playback.resetConfirm': 'Reset captions',
  'account.playback.resetCancel': 'Cancel',
} as const;
