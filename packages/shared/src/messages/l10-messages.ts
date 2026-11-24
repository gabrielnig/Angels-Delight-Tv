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
  'auth.twoStep.recoveryHint': 'Each recovery code works once. Letters can be any case and the dash is optional.',
  'auth.twoStep.recoveryWrong': 'That recovery code is not right or was already used.',
  'auth.twoStep.recoverySubmit': 'Sign in',
  'auth.twoStep.lost': 'Lost your phone? Contact support.',
  'auth.twoStep.lostWith': 'Lost your phone? Email {email}.',
} as const;
