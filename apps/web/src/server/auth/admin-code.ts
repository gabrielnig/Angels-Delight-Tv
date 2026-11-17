export type CodeKind =
  { kind: 'totp'; code: string } | { kind: 'recovery'; code: string } | { kind: 'invalid' };

/** Staff can type an authenticator code or one of their recovery codes in the same box. */
export function classifyCode(input: string): CodeKind {
  const value = input.trim();
  const compact = value.replace(/\s/g, '');
  if (/^\d{6}$/.test(compact)) return { kind: 'totp', code: compact };
  if (/^[a-z0-9]{5}-?[a-z0-9]{5}$/i.test(compact)) return { kind: 'recovery', code: compact };
  return { kind: 'invalid' };
}
