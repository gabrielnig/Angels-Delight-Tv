'use client';

import { useT } from '../../lib/i18n/provider';
import { useEffect, useState } from 'react';
import { evaluatePassword, MIN_PASSWORD_LENGTH, zxcvbnScorer, type PasswordScorer } from '@ad/ui';
import { AcctIcon } from './icons';

export interface PasswordRules {
  length: boolean;
  mix: boolean;
  common: boolean;
}

/** The three rules the mockup lists. The server stays the judge. */
export function passwordRules(value: string): PasswordRules {
  const ev = evaluatePassword(value, 0);
  return {
    length: ev.lengthOk,
    mix: /[A-Za-z]/.test(value) && /\d/.test(value),
    common: ev.notCommon && value.length > 0,
  };
}

export const rulesMet = (r: PasswordRules) => r.length && r.mix && r.common;

/** Four bar meter, a word (Weak, Okay, Strong) and the checklist with (met) or (not yet) spelled out. */
export function PasswordStrength({
  value,
  scorer = zxcvbnScorer,
}: {
  value: string;
  scorer?: PasswordScorer;
}) {
  const msg = useT();
  const [score, setScore] = useState(0);
  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    scorer(value)
      .then((s) => !cancelled && setScore(s))
      .catch(() => !cancelled && setScore(value.length >= MIN_PASSWORD_LENGTH ? 2 : 0));
    return () => {
      cancelled = true;
    };
  }, [value, scorer]);
  if (!value) return null;
  const ev = evaluatePassword(value, score);
  const rules = passwordRules(value);
  const word =
    ev.label === 'Strong'
      ? msg('account.strengthStrong')
      : ev.label === 'Okay'
        ? msg('account.strengthOkay')
        : msg('account.strengthWeak');
  const rows: [boolean, string][] = [
    [rules.length, msg('account.atLeastCharacters', { count: MIN_PASSWORD_LENGTH })],
    [rules.mix, msg('account.aLetterAndA')],
    [rules.common, msg('account.notACommonPassword')],
  ];
  return (
    <>
      <div className="acct-strength" data-tone={ev.tone}>
        <div className="acct-strength__bar" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} data-on={n <= Math.max(ev.segments, 1) ? 'true' : undefined} />
          ))}
        </div>
        <p className="acct-strength__word" aria-live="polite">
          <span className="ad-sr-only">{msg('account.passwordStrength')} </span>
          {word}
        </p>
      </div>
      <ul className="acct-checks">
        {rows.map(([met, text]) => (
          <li key={text} data-met={met ? 'true' : 'false'}>
            <AcctIcon name={met ? 'check' : 'close'} size={16} strokeWidth={met ? 2.5 : 2} />
            <span>{`${text} (${met ? 'met' : 'not yet'})`}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
