export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailError(value: string): string | undefined {
  const email = value.trim();
  if (!email) return 'Enter your email.';
  if (!EMAIL_PATTERN.test(email)) return 'Enter your full email, for example name@example.com.';
  return undefined;
}

export const NETWORK_MESSAGE =
  'We could not reach the server. Check your data or Wi-Fi, then try again.';
export const RATE_LIMIT_MESSAGE = 'Too many requests. Try again in 15 minutes.';
export const SIGN_UP_NETWORK_MESSAGE =
  'We could not reach the server. Your details are saved here. Check your connection and try again.';
export const SIGN_UP_RATE_LIMIT_MESSAGE =
  'Too many accounts were created from this connection. Try again in 15 minutes.';
