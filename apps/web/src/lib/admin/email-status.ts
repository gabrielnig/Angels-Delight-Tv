/** SMTP_URL=disabled lets a first deploy boot without email credentials. The dashboard says so until it is fixed. */
export const EMAIL_NOT_CONFIGURED_WARNING =
  'Email is not configured. Sign up verification and password reset emails cannot be sent. Set SMTP_URL and redeploy.';

export function emailNotConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return (env.SMTP_URL ?? '').trim().toLowerCase() === 'disabled';
}
