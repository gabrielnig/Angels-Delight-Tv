'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Banner, Button, Input, Link, PasswordField, evaluatePassword, type PasswordScorer } from '@ad/ui';
import type { SignUpResult } from '../../lib/data';
import { NETWORK_MESSAGE, RATE_LIMIT_MESSAGE, emailError } from './shared';
import { useFocusFirstInvalid } from './useFocusFirstInvalid';

export interface SignUpValues {
  email: string;
  password: string;
  inviteCode?: string;
}

export function SignUpForm({
  onSubmit,
  onDone,
  inviteOnly = false,
  scorer,
}: {
  onSubmit: (values: SignUpValues) => Promise<SignUpResult>;
  onDone: (next: string) => void;
  inviteOnly?: boolean;
  scorer?: PasswordScorer;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const requestFocus = useFocusFirstInvalid(formRef);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [trap, setTrap] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false, invite: false });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [serverField, setServerField] = useState<{ email?: string; password?: string }>({});

  const checks = evaluatePassword(password, 2);
  const passwordProblem = !password
    ? 'Enter a password.'
    : !checks.lengthOk
      ? 'Use at least 10 characters.'
      : !checks.notCommon
        ? 'That password is too common. Choose another.'
        : undefined;
  const inviteProblem = inviteOnly && !invite.trim() ? 'Enter your invite code.' : undefined;
  const show = (field: 'email' | 'password' | 'invite') => touched[field] || submitted;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setBanner(null);
    setServerField({});
    if (emailError(email) || passwordProblem || inviteProblem) {
      requestFocus();
      return;
    }
    if (trap) {
      // Honeypot: look like success, send nothing.
      onDone('/verify-email');
      return;
    }
    setBusy(true);
    try {
      const result = await onSubmit({ email: email.trim(), password, inviteCode: inviteOnly ? invite.trim() : undefined });
      if (result.ok) {
        onDone(result.next);
        return;
      }
      if (result.reason === 'rate_limited') setBanner(RATE_LIMIT_MESSAGE);
      else if (result.reason === 'network') setBanner(NETWORK_MESSAGE);
      else if (result.reason === 'invite_required') setBanner('That invite code is not valid. Check it and try again.');
      else if (result.reason === 'invalid_email') setServerField({ email: 'Enter your full email, for example name@example.com.' });
      else setServerField({ password: 'Use at least 10 characters.' });
      if (result.reason === 'invalid_email' || result.reason === 'weak_password') requestFocus();
    } catch {
      setBanner(NETWORK_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} className="web-form" onSubmit={submit} noValidate>
      {banner ? <Banner tone="danger">{banner}</Banner> : null}
      <Input
        label="Email"
        required
        type="email"
        name="email"
        inputMode="email"
        autoComplete="email"
        placeholder="name@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        onBlur={() => setTouched((current) => ({ ...current, email: true }))}
        error={(show('email') ? emailError(email) : undefined) ?? serverField.email}
      />
      <PasswordField
        label="Password (required)"
        name="password"
        mode="new"
        showStrength
        scorer={scorer}
        placeholder="Choose a password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onBlur={() => setTouched((current) => ({ ...current, password: true }))}
        error={(show('password') ? passwordProblem : undefined) ?? serverField.password}
      />
      {inviteOnly ? (
        <Input
          label="Invite code"
          required
          name="invite"
          autoComplete="off"
          value={invite}
          onChange={(event) => setInvite(event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, invite: true }))}
          error={show('invite') ? inviteProblem : undefined}
        />
      ) : null}
      <div className="web-hp" aria-hidden="true">
        <input name="website" tabIndex={-1} autoComplete="off" value={trap} onChange={(event) => setTrap(event.target.value)} />
      </div>
      <p className="web-form__fine">
        By creating an account you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
      </p>
      <Button type="submit" size="lg" fullWidth loading={busy}>
        {busy ? 'Creating account' : 'Create account'}
      </Button>
      <p className="web-form__alt">
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </form>
  );
}
