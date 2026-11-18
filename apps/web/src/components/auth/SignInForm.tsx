'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Banner, Button, Checkbox, Input, Link, PasswordField } from '@ad/ui';
import type { AuthResult } from '../../lib/data';
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
  turnstileSiteKey,
}: {
  onSubmit: (values: SignInValues) => Promise<AuthResult>;
  onDone: (next: string) => void;
  next?: string;
  signUpOpen: boolean;
  /** Success notice, for example after a password reset. */
  notice?: string;
  /** Turns on the Cloudflare Turnstile check. Leave out when no keys are configured. */
  turnstileSiteKey?: string;
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
    <form ref={formRef} className="web-form" onSubmit={submit} noValidate>
      {notice && !problem ? <Banner tone="success">{notice}</Banner> : null}
      {problem?.kind === 'invalid' ? (
        <Banner tone="danger">
          That email or password is not right. Check them and try again.
        </Banner>
      ) : null}
      {problem?.kind === 'network' ? <Banner tone="danger">{NETWORK_MESSAGE}</Banner> : null}
      {problem?.kind === 'unavailable' ? (
        <Banner tone="danger">Sign in is temporarily unavailable. Try again in a moment.</Banner>
      ) : null}
      {problem?.kind === 'rate_limited' ? (
        <Banner tone="warning">{RATE_LIMIT_MESSAGE}</Banner>
      ) : null}
      {problem?.kind === 'locked' ? (
        <Banner tone="warning" title="Sign in is paused">
          {`Too many attempts. Try again in ${problem.minutes} minutes.`}{' '}
          <Link href="/forgot-password">Reset your password</Link> if you cannot remember it.
        </Banner>
      ) : null}
      {problem?.kind === 'checking' ? <Banner tone="info">{CHECK_RUNNING_MESSAGE}</Banner> : null}
      {problem?.kind === 'check' ? (
        <Banner tone="info" title="One more step">
          Too many attempts from this connection. Complete the check below, then try again.
        </Banner>
      ) : null}

      <Input
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
      <PasswordField
        label="Password"
        name="password"
        mode="current"
        placeholder="Your password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onBlur={() => setTouched((current) => ({ ...current, password: true }))}
        error={shownPasswordError}
      />
      <Link href="/forgot-password" className="web-link web-link--end">
        Forgot your password?
      </Link>
      {turnstile.widget}
      {problem?.kind === 'check' && !turnstile.enabled ? (
        <Checkbox
          label="I am a person"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
      ) : null}
      <Button type="submit" size="lg" fullWidth loading={busy} disabled={lockedMinutes !== null}>
        {busy
          ? 'Signing in'
          : lockedMinutes !== null
            ? `Try again in ${lockedMinutes} min`
            : 'Sign in'}
      </Button>
      {signUpOpen ? (
        <p className="web-form__alt">
          New here? <Link href="/sign-up">Create an account</Link>
        </p>
      ) : null}
    </form>
  );
}
