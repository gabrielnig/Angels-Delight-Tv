import { describe, expect, it } from 'vitest';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, checkPassword } from './policy';

describe('checkPassword', () => {
  it('passes a long unusual password and lists all three rules as met', () => {
    const result = checkPassword('river-lantern-42-mango', 'tobi@example.com');
    expect(result.ok).toBe(true);
    expect(result.rules.map((rule) => [rule.id, rule.passed])).toEqual([
      ['length', true],
      ['not_common', true],
      ['not_email', true],
    ]);
  });

  it('requires at least 10 characters', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
    const result = checkPassword('abc123xyz', 'a@b.co');
    expect(result.ok).toBe(false);
    expect(result.rules.find((rule) => rule.id === 'length')?.passed).toBe(false);
  });

  it('accepts exactly 10 and 128 characters and rejects 129', () => {
    expect(checkPassword('q7!Lm2#Xz9', 'a@b.co').rules[0]?.passed).toBe(true);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
    expect(checkPassword('aB3$'.repeat(32), 'a@b.co').rules[0]?.passed).toBe(true);
    expect(checkPassword('aB3$'.repeat(32) + 'x', 'a@b.co').rules[0]?.passed).toBe(false);
  });

  it('rejects very common passwords even when long enough', () => {
    for (const password of ['password123', 'qwertyuiop', '1234567890', 'iloveyou12', 'Password1234']) {
      const result = checkPassword(password, 'a@b.co');
      expect(result.rules.find((rule) => rule.id === 'not_common')?.passed, password).toBe(false);
    }
  });

  it('rejects the email address and its local part as the password', () => {
    expect(checkPassword('tobi.adeyemi@example.com', 'tobi.adeyemi@example.com').ok).toBe(false);
    expect(checkPassword('tobi.adeyemi', 'tobi.adeyemi@example.com').ok).toBe(false);
    expect(checkPassword('TOBI.ADEYEMI', 'tobi.adeyemi@example.com').ok).toBe(false);
  });

  it('allows spaces, unicode and pasted symbols', () => {
    expect(checkPassword('correct horse battery staple', 'a@b.co').ok).toBe(true);
    expect(checkPassword('ọmọ mi dára gan-an', 'a@b.co').ok).toBe(true);
  });

  it('shows neutral state for an empty field', () => {
    const result = checkPassword('', '');
    expect(result.rules.every((rule) => rule.passed === null)).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('gives a plain strength word that is advice, not a gate', () => {
    expect(checkPassword('aaaaaaaaaaaa', 'a@b.co').strength.label).toBe('Weak');
    expect(checkPassword('river-lantern-42-mango', 'a@b.co').strength.label).toBe('Strong');
    expect(checkPassword('Sunday12345', 'a@b.co').strength.score).toBeLessThan(3);
    const fair = checkPassword('purple-monkey', 'a@b.co');
    expect(['Fair', 'Good']).toContain(fair.strength.label);
  });
});
