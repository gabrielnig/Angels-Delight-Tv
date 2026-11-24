'use client';

import { useT } from '../../lib/i18n/provider';
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
  const msg = useT();
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
        <h1 className="web-auth__title">{msg('auth.checkYourEmail')}</h1>
        <p>{msg('auth.ifThatEmailHas')}</p>
        <p className="web-muted">{msg('auth.notThereCheckYour')}</p>
        <ButtonLink href="/sign-in" variant="secondary" fullWidth>
          {msg('auth.backToSignIn')}
        </ButtonLink>
      </div>
    );
  }

  return (
    <form ref={formRef} className="web-form" onSubmit={submit} noValidate>
      <h1 className="web-auth__title">{msg('auth.forgotYourPassword')}</h1>
      <p className="web-muted">{msg('auth.enterYourEmailWe')}</p>
      {banner ? <Banner tone="danger">{banner}</Banner> : null}
      <Input
        label="Email"
        required
        type="email"
        name="email"
        inputMode="email"
        autoComplete="email"
        placeholder={msg('auth.nameExampleCom')}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        onBlur={() => setTouched(true)}
        error={touched ? emailError(email) : undefined}
      />
      <Button type="submit" size="lg" fullWidth loading={busy}>
        {busy ? msg('auth.sendingLink') : msg('auth.sendLink')}
      </Button>
      <p className="web-form__alt">
        {msg('auth.rememberedIt')} <Link href="/sign-in">{msg('auth.signIn')}</Link>
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
  const msg = useT();
  const formRef = useRef<HTMLFormElement>(null);
  const requestFocus = useFocusFirstInvalid(formRef);
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const checks = evaluatePassword(password, 2);
  const problem = !password
    ? msg('auth.enterANewPassword')
    : !checks.lengthOk
      ? msg('auth.useAtLeast10')
      : !checks.notCommon
        ? msg('auth.thatPasswordIsToo')
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
      else if (result.reason === 'weak_password') setBanner(msg('auth.thatPasswordIsToo2'));
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
        <h1 className="web-auth__title">{msg('auth.thisLinkHasExpired')}</h1>
        <p className="web-muted">{msg('auth.linksWorkFor1')}</p>
        <ButtonLink href="/forgot-password" fullWidth>
          {msg('auth.sendANewLink')}
        </ButtonLink>
        <ButtonLink href="/sign-in" variant="secondary" fullWidth>
          {msg('auth.backToSignIn')}
        </ButtonLink>
      </div>
    );
  }

  return (
    <form ref={formRef} className="web-form" onSubmit={submit} noValidate>
      <h1 className="web-auth__title">{msg('auth.chooseANewPassword')}</h1>
      <p className="web-muted">{msg('auth.pickSomethingYouWill')}</p>
      {banner ? <Banner tone="danger">{banner}</Banner> : null}
      <PasswordField
        label="New password (required)"
        name="password"
        mode="new"
        showStrength
        scorer={scorer}
        placeholder={msg('auth.chooseAPassword')}
        hint="Use the eye button to check what you typed. There is no second box."
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onBlur={() => setTouched(true)}
        error={touched ? problem : undefined}
      />
      <Button type="submit" size="lg" fullWidth loading={busy}>
        {busy ? msg('auth.saving') : msg('auth.savePassword')}
      </Button>
    </form>
  );
}
