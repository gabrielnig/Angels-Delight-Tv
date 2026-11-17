'use client';

import { useRef, useState, type FormEvent } from 'react';
import {
  Banner,
  Button,
  ButtonLink,
  Input,
  Link,
  PasswordField,
  evaluatePassword,
  type PasswordScorer,
} from '@ad/ui';
import { NETWORK_MESSAGE, RATE_LIMIT_MESSAGE, emailError } from './shared';
import { useFocusFirstInvalid } from './useFocusFirstInvalid';

export function ForgotPasswordForm({
  onSubmit,
}: {
  onSubmit: (input: {
    email: string;
  }) => Promise<{ ok: true } | { ok: false; reason: 'rate_limited' | 'network' }>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const requestFocus = useFocusFirstInvalid(formRef);
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    setBanner(null);
    if (emailError(email)) {
      requestFocus();
      return;
    }
    setBusy(true);
    try {
      const result = await onSubmit({ email: email.trim() });
      if (result.ok) setSent(true);
      else setBanner(result.reason === 'rate_limited' ? RATE_LIMIT_MESSAGE : NETWORK_MESSAGE);
    } catch {
      setBanner(NETWORK_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="web-form">
        <h1 className="web-auth__title">Check your email</h1>
        <p>If that email has an account, we sent a link. It works for 1 hour.</p>
        <p className="web-muted">
          Not there? Check your spam folder, or try again in a few minutes.
        </p>
        <ButtonLink href="/sign-in" variant="secondary" fullWidth>
          Back to sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <form ref={formRef} className="web-form" onSubmit={submit} noValidate>
      <h1 className="web-auth__title">Forgot your password?</h1>
      <p className="web-muted">
        Enter your email. We will send you a link to choose a new password.
      </p>
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
        onBlur={() => setTouched(true)}
        error={touched ? emailError(email) : undefined}
      />
      <Button type="submit" size="lg" fullWidth loading={busy}>
        {busy ? 'Sending link' : 'Send link'}
      </Button>
      <p className="web-form__alt">
        Remembered it? <Link href="/sign-in">Sign in</Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({
  token,
  onSubmit,
  onDone,
  scorer,
}: {
  token: string;
  onSubmit: (input: {
    token: string;
    password: string;
  }) => Promise<{ ok: true } | { ok: false; reason: 'expired' | 'weak_password' | 'network' }>;
  onDone: () => void;
  scorer?: PasswordScorer;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const requestFocus = useFocusFirstInvalid(formRef);
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const checks = evaluatePassword(password, 2);
  const problem = !password
    ? 'Enter a new password.'
    : !checks.lengthOk
      ? 'Use at least 10 characters.'
      : !checks.notCommon
        ? 'That password is too common. Choose another.'
        : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    setBanner(null);
    if (problem) {
      requestFocus();
      return;
    }
    setBusy(true);
    try {
      const result = await onSubmit({ token, password });
      if (result.ok) onDone();
      else if (result.reason === 'expired') setExpired(true);
      else if (result.reason === 'weak_password')
        setBanner('That password is too short or too common. Choose another.');
      else setBanner(NETWORK_MESSAGE);
    } catch {
      setBanner(NETWORK_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  if (expired) {
    return (
      <div className="web-form">
        <h1 className="web-auth__title">This link has expired</h1>
        <p className="web-muted">Links work for 1 hour. We can send you a new one.</p>
        <ButtonLink href="/forgot-password" fullWidth>
          Send a new link
        </ButtonLink>
        <ButtonLink href="/sign-in" variant="secondary" fullWidth>
          Back to sign in
        </ButtonLink>
      </div>
    );
  }

  return (
    <form ref={formRef} className="web-form" onSubmit={submit} noValidate>
      <h1 className="web-auth__title">Choose a new password</h1>
      <p className="web-muted">Pick something you will remember. Longer is better.</p>
      {banner ? <Banner tone="danger">{banner}</Banner> : null}
      <PasswordField
        label="New password (required)"
        name="password"
        mode="new"
        showStrength
        scorer={scorer}
        placeholder="Choose a password"
        hint="Use the eye button to check what you typed. There is no second box."
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onBlur={() => setTouched(true)}
        error={touched ? problem : undefined}
      />
      <Button type="submit" size="lg" fullWidth loading={busy}>
        {busy ? 'Saving' : 'Save password'}
      </Button>
    </form>
  );
}
