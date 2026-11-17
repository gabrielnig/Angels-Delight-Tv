export const MIN_PASSWORD_LENGTH = 10;

/** Small blocklist for the "not a common password" hard rule. The server holds the full list. */
const COMMON = new Set([
  'password',
  'password1',
  'password123',
  'passw0rd',
  '1234567890',
  '12345678910',
  '123456789',
  'qwertyuiop',
  'qwerty123',
  'iloveyou',
  'iloveyou1',
  'welcome123',
  'admin12345',
  'letmein123',
  'abc1234567',
  'abcdefghij1',
  '0123456789',
  'angelsdelight',
  'nigeria123',
  'lagos12345',
]);

export type StrengthLabel = 'Too short' | 'Weak' | 'Okay' | 'Strong';

export interface PasswordEvaluation {
  lengthOk: boolean;
  notCommon: boolean;
  label: StrengthLabel;
  /** 0 to 4 filled meter segments. */
  segments: number;
  tone: 'danger' | 'warning' | 'info' | 'success';
  /** Both hard rules pass. */
  acceptable: boolean;
}

/** score is a zxcvbn style 0 to 4. */
export function evaluatePassword(password: string, score: number): PasswordEvaluation {
  const lengthOk = password.length >= MIN_PASSWORD_LENGTH;
  const notCommon = !COMMON.has(password.toLowerCase());
  let label: StrengthLabel;
  let segments: number;
  if (!lengthOk) {
    label = 'Too short';
    segments = password.length === 0 ? 0 : 1;
  } else if (!notCommon || score <= 1) {
    label = 'Weak';
    segments = notCommon ? Math.max(1, score + 1) : 1;
  } else if (score === 2) {
    label = 'Okay';
    segments = 3;
  } else {
    label = 'Strong';
    segments = 4;
  }
  const tone =
    label === 'Strong'
      ? 'success'
      : label === 'Okay'
        ? 'info'
        : label === 'Weak' && segments > 1
          ? 'warning'
          : 'danger';
  return { lengthOk, notCommon, label, segments, tone, acceptable: lengthOk && notCommon };
}

export type PasswordScorer = (password: string) => Promise<number>;

/** Loads zxcvbn on first use so viewer pages that never ask for a new password do not ship it. */
export const zxcvbnScorer: PasswordScorer = async (password) => {
  const module = await import('zxcvbn');
  const zxcvbn =
    (module as { default?: (value: string) => { score: number } }).default ??
    (module as unknown as (value: string) => { score: number });
  return zxcvbn(password.slice(0, 100)).score;
};
