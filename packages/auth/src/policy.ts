import { COMMON_BASE_WORDS, COMMON_PASSWORDS } from './common-passwords';

/** Pure functions only. This module is imported by the browser for live guidance and by the server as the gate. */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export type RuleId = 'length' | 'not_common' | 'not_email';

export interface PasswordRule {
  id: RuleId;
  label: string;
  /** null means the field is empty, so the rule is shown neutral rather than red. */
  passed: boolean | null;
}

export type StrengthLabel = 'Weak' | 'Fair' | 'Good' | 'Strong';

export interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: StrengthLabel;
  hint: string;
}

export interface PasswordCheck {
  ok: boolean;
  rules: PasswordRule[];
  strength: Strength;
}

function isCommon(password: string): boolean {
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return true;
  if (/^(\d)\1+$/.test(lower) || isDigitRun(lower)) return true;
  const stripped = lower.replace(/^[\d!@#$%^&*._-]+|[\d!@#$%^&*._-]+$/g, '');
  const tail = lower.length - stripped.length;
  return stripped.length >= 4 && tail <= 5 && COMMON_BASE_WORDS.has(stripped);
}

function isDigitRun(value: string): boolean {
  if (!/^\d{6,}$/.test(value)) return false;
  const steps = new Set<number>();
  for (let i = 1; i < value.length; i++) {
    steps.add((Number(value[i]) - Number(value[i - 1]) + 10) % 10);
  }
  return steps.size === 1 && (steps.has(1) || steps.has(9));
}

function matchesEmail(password: string, email: string): boolean {
  const lower = password.toLowerCase();
  const address = email.trim().toLowerCase();
  if (!address) return false;
  const local = address.split('@')[0] ?? '';
  return lower === address || (local.length >= 3 && lower === local);
}

function countClasses(value: string): number {
  return [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(value)).length;
}

function hasSequence(value: string): boolean {
  const lower = value.toLowerCase();
  if (/(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf|zxcv)/.test(lower))
    return true;
  return /(19|20)\d{2}$/.test(lower);
}

function estimateStrength(password: string): Strength {
  const length = [...password].length;
  let score = length < 10 ? 0 : length < 12 ? 1 : length < 16 ? 2 : length < 20 ? 3 : 4;
  if (length >= 10) {
    const classes = countClasses(password);
    const unique = new Set(password).size;
    if (unique < length / 3) score -= 2;
    if (hasSequence(password) || isCommon(password)) score -= 1;
    if (classes === 1 && length < 16) score -= 1;
    if (classes >= 3 && length >= 12) score += 1;
  }
  const clamped = Math.max(0, Math.min(4, score)) as Strength['score'];
  const label: StrengthLabel = (['Weak', 'Weak', 'Fair', 'Good', 'Strong'] as const)[clamped];
  const hint =
    clamped >= 3
      ? 'Nice and long.'
      : 'Try a few unrelated words together, for example three words and a number.';
  return { score: clamped, label, hint };
}

/** The checklist is the gate, the strength meter is advice (M01-S02). */
export function checkPassword(password: string, email: string): PasswordCheck {
  const empty = password.length === 0;
  const length = [...password].length;
  const rules: PasswordRule[] = [
    {
      id: 'length',
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      passed: empty ? null : length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH,
    },
    {
      id: 'not_common',
      label: 'Not a very common password',
      passed: empty ? null : !isCommon(password),
    },
    {
      id: 'not_email',
      label: 'Not the same as your email',
      passed: empty ? null : !matchesEmail(password, email),
    },
  ];
  return {
    ok: rules.every((rule) => rule.passed === true),
    rules,
    strength: empty ? { score: 0, label: 'Weak', hint: '' } : estimateStrength(password),
  };
}
