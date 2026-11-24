import type { BucketPolicy } from './rate-limit';
import type { LockoutPolicy } from './lockout';

const perMinutes = (name: string, capacity: number, minutes: number): BucketPolicy => ({
  name,
  capacity,
  refillPerSecond: capacity / (minutes * 60),
});

/** Defaults from SECURITY.md section 7. Constants, so tests can pin them and a review can change them in one place. */
export const RATE_POLICIES = {
  loginIp: perMinutes('login-ip', 20, 15),
  signupIp: perMinutes('signup-ip', 5, 60),
  resetRequestEmail: perMinutes('reset-email', 3, 60),
  resetRequestIp: perMinutes('reset-ip', 10, 60),
  verifyResendAccount: perMinutes('verify-resend', 3, 60),
  lockoutNoticeAccount: perMinutes('lockout-notice', 1, 60),
  newDeviceMail: perMinutes('new-device-mail', 1, 60),
  adminGeneral: perMinutes('admin-general', 300, 1),
  globalApiIp: perMinutes('api-ip', 300, 1),
  inviteSend: perMinutes('invite-send', 20, 60),
} as const;

/** D-004: viewers lock after 5 failures in 15 minutes for 15 minutes, admins after 3 for 30 minutes. */
export const LOCKOUT_POLICIES = {
  viewerLogin: { maxFailures: 5, windowSeconds: 900, lockSeconds: 900 },
  adminLogin: { maxFailures: 3, windowSeconds: 900, lockSeconds: 1800 },
  mfaCode: { maxFailures: 5, windowSeconds: 900, lockSeconds: 900 },
  reauth: { maxFailures: 5, windowSeconds: 900, lockSeconds: 900 },
} as const satisfies Record<string, LockoutPolicy>;
