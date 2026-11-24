'use client';

import { useT } from '../../lib/i18n/provider';
import { useRef, useState, type FormEvent } from 'react';
import { Button, type PasswordScorer } from '@ad/ui';
import { changePasswordAction } from '../../app/actions';
import { NETWORK_MESSAGE } from '../auth/shared';
import { AcctField } from './Field';
import { AcctIcon } from './icons';
import { PasswordStrength, passwordRules, rulesMet } from './PasswordStrength';

type Result =
  | { ok: true; signedOutDevices: number }
  | { ok: false; reason: 'wrong_current' | 'weak' | 'network' };

type Errors = { current?: string; next?: string; again?: string; nextRules?: boolean };

/** The Password card of the security screen (S28 states 1 to 3). */
export function ChangePasswordForm({
  lastChanged,
  change = changePasswordAction,
  onChanged,
  scorer,
}: {
  lastChanged: string;
  change?: (input: { current: string; next: string }) => Promise<Result>;
  onChanged?: (signedOutDevices: number) => void;
  scorer?: PasswordScorer;
}) {
  const msg = useT();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const currentRef = useRef<HTMLInputElement | null>(null);
  const nextRef = useRef<HTMLInputElement | null>(null);
  const againRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setCurrent('');
    setNext('');
    setAgain('');
    setErrors({});
    setProblem(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    const found: Errors = {};
    if (!current) found.current = msg('account.enterYourCurrentPassword');
    if (!next || !rulesMet(passwordRules(next))) found.nextRules = true;
    if (next !== again) found.again = msg('account.thePasswordsDoNot');
    if (found.current || found.nextRules || found.again) {
      setErrors(found);
      const first = found.current ? currentRef : found.nextRules ? nextRef : againRef;
      first.current?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const result = await change({ current, next });
      if (result.ok) {
        reset();
        onChanged?.(result.signedOutDevices);
      } else if (result.reason === 'wrong_current') {
        setErrors({ current: msg('account.currentPasswordIsNot') });
        currentRef.current?.focus();
      } else if (result.reason === 'weak') {
        setErrors({ next: msg('account.chooseALongerLess') });
      } else {
        setProblem(NETWORK_MESSAGE);
      }
    } catch {
      setProblem(NETWORK_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="acct-card" aria-labelledby="acct-password">
      <div className="acct-row" data-between data-wrap>
        <h2 id="acct-password" className="acct-h2">
          {msg('account.password')}
        </h2>
        <span className="acct-muted acct-small">{msg('account.lastChanged', { lastChanged })}</span>
      </div>
      <form className="acct-form" onSubmit={(e) => void onSubmit(e)} noValidate>
        {problem ? (
          <p className="acct-field__error" role="alert">
            <AcctIcon name="warning" size={16} />
            <span>{problem}</span>
          </p>
        ) : null}
        <AcctField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={errors.current}
          inputRef={(el) => (currentRef.current = el)}
        />
        <AcctField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={errors.next}
          invalid={errors.nextRules}
          inputRef={(el) => (nextRef.current = el)}
        />
        <PasswordStrength value={next} scorer={scorer} />
        <AcctField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          error={errors.again}
          ok={again.length > 0 && again === next && !errors.again}
          inputRef={(el) => (againRef.current = el)}
        />
        <div className="acct-row" data-tight data-wrap>
          <Button type="submit" loading={busy}>
            {msg('account.updatePassword')}
          </Button>
          <Button variant="secondary" onClick={reset}>
            {msg('account.cancel')}
          </Button>
        </div>
      </form>
      <p className="acct-muted acct-small">{msg('account.changingYourPasswordSigns')}</p>
    </section>
  );
}
