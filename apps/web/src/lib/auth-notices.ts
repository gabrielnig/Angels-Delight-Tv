const NOTICES: Record<string, string> = {
  reset: 'Your password was changed. Sign in with your new password.',
  ended: 'Your session ended. Sign in again to keep watching.',
};

const TONES: Record<string, 'success' | 'info'> = { reset: 'success', ended: 'info' };

export function signInNotice(code: string | undefined): string | undefined {
  return code && Object.hasOwn(NOTICES, code) ? NOTICES[code] : undefined;
}

export function signInNoticeTone(code: string | undefined): 'success' | 'info' | undefined {
  return code && Object.hasOwn(TONES, code) ? TONES[code] : undefined;
}

export function signInRedirect(next: string, notice?: 'ended'): string {
  return `/sign-in?next=${encodeURIComponent(next)}${notice ? `&notice=${notice}` : ''}`;
}
