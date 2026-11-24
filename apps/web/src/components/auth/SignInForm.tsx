'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Checkbox, Link } from '@ad/ui';
import type { AuthResult } from '../../lib/data';
import { SocialButtons } from './SocialButtons';
import { AuthBanner, AuthField, AuthPasswordField, AuthSubmit } from './AuthParts';
import { NETWORK_MESSAGE, RATE_LIMIT_MESSAGE, emailError } from './shared';
import { useFocusFirstInvalid } from './useFocusFirstInvalid';
import { CHECK_RUNNING_MESSAGE, useTurnstile } from './useTurnstile';

export interface SignInValues {
  email: string;
  password: string;
  next?: string;
  challengeToken?: string;
}

type Problem =
  | { kind: 'invalid' }
  | { kind: 'network' }
  | { kind: 'locked'; minutes: number }
  | { kind: 'rate_limited'; minutes: number }
  | { kind: 'unavailable' }
  | { kind: 'check' }
  | { kind: 'checking' };

export function SignInForm({
  onSubmit,
  onDone,
  next,
  signUpOpen,
  notice,
  noticeTone = 'success',
  turnstileSiteKey,
  google,
}: {
  onSubmit: (values: SignInValues) => Promise<AuthResult>;
  onDone: (next: string) => void;
  next?: string;
  signUpOpen: boolean;
  /** Success notice, for example after a password reset. */
  notice?: string;
  /** Success after a reset, information after a session ended. */
  noticeTone?: 'success' | 'info';
  /** Turns on the Cloudflare Turnstile check. Leave out when no keys are configured. */
  turnstileSiteKey?: string;
  /** Draws Continue with Google under the main button. Leave out when Google is not configured. */
  google?: { href: string } | null;
}) {
  const turnstile = useTurnstile(turnstileSiteKey);
  const formRef = useRef<HTMLFormElement>(null);
  const requestFocus = useFocusFirstInvalid(formRef);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [checked, setChecked] = useState(false);

  const shownEmailError = touched.email || submitted ? emailError(email) : undefined;
  const shownPasswordError =
    (touched.password || submitted) && !password ? 'Enter your password.' : undefined;
  const lockedMinutes = problem?.kind === 'locked' ? problem.minutes : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (emailError(email) || !password) {
      requestFocus();
      return;
    }
    if (turnstile.enabled && !turnstile.token) {
      setProblem({ kind: 'checking' });
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const values: SignInValues = { email: email.trim(), password, next };
      if (turnstile.token) values.challengeToken = turnstile.token;
      else if (problem?.kind === 'check' && checked) values.challengeToken = 'checked';
      const result = await onSubmit(values);
      if (result.ok) {
        onDone(result.next);
        return;
      }
      switch (result.reason) {
        case 'locked':
          setProblem({ kind: 'locked', minutes: result.minutes });
          break;
        case 'rate_limited':
          setProblem({ kind: 'rate_limited', minutes: result.minutes });
          break;
        case 'check_required':
          setProblem({ kind: 'check' });
          break;
        case 'unavailable':
          setProblem({ kind: 'unavailable' });
          break;
        case 'network':
          setProblem({ kind: 'network' });
          break;
        default:
          setProblem({ kind: 'invalid' });
      }
    } catch {
      setProblem({ kind: 'network' });
    } finally {
      setBusy(false);
      turnstile.spent();
    }
  }

  return (
    <form ref={formRef} className="auth-form" onSubmit={submit} noValidate>
      {notice && !problem ? <AuthBanner tone={noticeTone}>{notice}</AuthBanner> : null}
      {problem?.kind === 'invalid' ? (
        <AuthBanner tone="danger">
          That email or password is not right. Check them and try again.
        </AuthBanner>
      ) : null}
      {problem?.kind === 'network' ? (
        <AuthBanner tone="danger">{NETWORK_MESSAGE}</AuthBanner>
      ) : null}
      {problem?.kind === 'unavailable' ? (
        <AuthBanner tone="warning">
          Sign in is temporarily unavailable. Try again in a moment.
        </AuthBanner>
      ) : null}
      {problem?.kind === 'rate_limited' ? (
        <AuthBanner tone="warning" icon="clock">
          {RATE_LIMIT_MESSAGE}
        </AuthBanner>
      ) : null}
      {problem?.kind === 'locked' ? (
        <AuthBanner tone="warning" title="Sign in is paused">
          {`Too many attempts. Try again in ${problem.minutes} minutes.`}{' '}
          <Link href="/forgot-password">Reset your password</Link> if you cannot remember it.
        </AuthBanner>
      ) : null}
      {problem?.kind === 'checking' ? (
        <AuthBanner tone="info">{CHECK_RUNNING_MESSAGE}</AuthBanner>
      ) : null}
      {problem?.kind === 'check' ? (
        <AuthBanner tone="info" title="One more step">
          Too many attempts from this connection. Complete the check below, then try again.
        </AuthBanner>
      ) : null}

      <AuthField
        label="Email"
        type="email"
        name="email"
        inputMode="email"
        autoComplete="email"
        enterKeyHint="next"
        placeholder="name@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        onBlur={() => setTouched((current) => ({ ...current, email: true }))}
        error={shownEmailError}
      />
      <AuthPasswordField
        label="Password"
        name="password"
        mode="current"
        placeholder="Your password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onBlur={() => setTouched((current) => ({ ...current, password: true }))}
        error={shownPasswordError}
        invalid={problem?.kind === 'invalid'}
      />
      <div className="auth-forgot">
        <Link href="/forgot-password" className="auth-link">
          Forgot your password?
        </Link>
      </div>
      {turnstile.widget}
      {problem?.kind === 'check' && !turnstile.enabled ? (
        <Checkbox
          label="I am a person"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
      ) : null}
      <AuthSubmit loading={busy} disabled={lockedMinutes !== null}>
        {busy
          ? 'Signing in'
          : lockedMinutes !== null
            ? `Try again in ${lockedMinutes} min`
            : 'Sign in'}
      </AuthSubmit>
      <SocialButtons google={google} next={next} />
      {signUpOpen ? (
        <p className="auth-alt">
          New here?{' '}
          <Link href="/sign-up" className="auth-link">
            Create an account
          </Link>
        </p>
      ) : null}
    </form>
  );
}
