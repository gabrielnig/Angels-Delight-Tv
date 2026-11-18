const NOTICES: Record<string, string> = {
  reset: 'Your password was changed. Sign in with your new password.',
  ended:
    'You were signed out. Your session ended, for example because you signed out on another device or it expired. Sign in again to continue.',
};

export function signInNotice(code: string | undefined): string | undefined {
  return code && Object.hasOwn(NOTICES, code) ? NOTICES[code] : undefined;
}

export function signInRedirect(next: string, notice?: 'ended'): string {
  return `/sign-in?next=${encodeURIComponent(next)}${notice ? `&notice=${notice}` : ''}`;
}
