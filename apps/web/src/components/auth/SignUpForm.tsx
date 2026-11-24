'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Link, evaluatePassword, type PasswordScorer } from '@ad/ui';
import type { SignUpResult } from '../../lib/data';
import { SocialButtons } from './SocialButtons';
import { AuthBanner, AuthField, AuthPasswordField, AuthSubmit } from './AuthParts';
import { SIGN_UP_NETWORK_MESSAGE, SIGN_UP_RATE_LIMIT_MESSAGE, emailError } from './shared';
import { useFocusFirstInvalid } from './useFocusFirstInvalid';
import { CHECK_RUNNING_MESSAGE, useTurnstile } from './useTurnstile';

export interface SignUpValues {
  email: string;
  password: string;
  inviteCode?: string;
  challengeToken?: string;
}

export function SignUpForm({
  onSubmit,
  onDone,
  inviteOnly = false,
  scorer,
  turnstileSiteKey,
  google,
}: {
  onSubmit: (values: SignUpValues) => Promise<SignUpResult>;
  onDone: (next: string) => void;
  inviteOnly?: boolean;
  scorer?: PasswordScorer;
  /** Turns on the Cloudflare Turnstile check. Leave out when no keys are configured. */
  turnstileSiteKey?: string;
  /** Draws Sign up with Google under the main button. Leave out when Google is not configured or sign up is closed. */
  google?: { href: string } | null;
}) {
  const turnstile = useTurnstile(turnstileSiteKey);
  const formRef = useRef<HTMLFormElement>(null);
  const requestFocus = useFocusFirstInvalid(formRef);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [trap, setTrap] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false, invite: false });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{
    text: string;
    tone: 'danger' | 'warning';
    icon?: 'clock';
  } | null>(null);
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
    if (turnstile.enabled && !turnstile.token) {
      setBanner({ text: CHECK_RUNNING_MESSAGE, tone: 'danger' });
      return;
    }
    setBusy(true);
    try {
      const result = await onSubmit({
        email: email.trim(),
        password,
        inviteCode: inviteOnly ? invite.trim() : undefined,
        challengeToken: turnstile.token ?? undefined,
      });
      if (result.ok) {
        onDone(result.next);
        return;
      }
      if (result.reason === 'check_required')
        setBanner({ text: 'We could not confirm the security check. Try again.', tone: 'danger' });
      else if (result.reason === 'rate_limited')
        setBanner({ text: SIGN_UP_RATE_LIMIT_MESSAGE, tone: 'warning', icon: 'clock' });
      else if (result.reason === 'network')
        setBanner({ text: SIGN_UP_NETWORK_MESSAGE, tone: 'danger' });
      else if (result.reason === 'invite_required')
        setBanner({
          text: 'That invite code is not valid. Check it and try again.',
          tone: 'danger',
        });
      else if (result.reason === 'invalid_email')
        setServerField({ email: 'Enter your full email, for example name@example.com.' });
      else setServerField({ password: 'Use at least 10 characters.' });
      if (result.reason === 'invalid_email' || result.reason === 'weak_password') requestFocus();
    } catch {
      setBanner({ text: SIGN_UP_NETWORK_MESSAGE, tone: 'danger' });
    } finally {
      setBusy(false);
      turnstile.spent();
    }
  }

  return (
    <form ref={formRef} className="auth-form auth-form--sticky" onSubmit={submit} noValidate>
      {banner ? (
        <AuthBanner tone={banner.tone} icon={banner.icon}>
          {banner.text}
        </AuthBanner>
      ) : null}
      <AuthField
        label="Email (required)"
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
      {inviteOnly ? (
        <AuthField
          label="Invite code (required)"
          required
          name="invite"
          autoComplete="off"
          value={invite}
          onChange={(event) => setInvite(event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, invite: true }))}
          error={show('invite') ? inviteProblem : undefined}
          hint="Sign up is by invitation for now."
        />
      ) : null}
      <AuthPasswordField
        label="Password (required)"
        required
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
      <div className="auth-hp" aria-hidden="true">
        <input
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={trap}
          onChange={(event) => setTrap(event.target.value)}
        />
      </div>
      {turnstile.widget}
      <p className="auth-fine">
        By creating an account you agree to the <Link href="/terms">Terms</Link> and{' '}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
      <div className="auth-sticky">
        <AuthSubmit loading={busy}>{busy ? 'Creating account' : 'Create account'}</AuthSubmit>
        <SocialButtons google={google} variant="signUp" />
      </div>
      <p className="auth-alt">
        Already have an account?{' '}
        <Link href="/sign-in" className="auth-link">
          Sign in
        </Link>
      </p>
    </form>
  );
}
