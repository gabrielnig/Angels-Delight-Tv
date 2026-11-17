'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/admin/Button';
import { TextField } from '@/components/admin/fields';
import { useTurnstile } from '@/components/auth/useTurnstile';
import { signInAction } from './actions';
import type { LoginState } from './actions';

export function LoginForm({ next, turnstileSiteKey }: { next: string; turnstileSiteKey?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInAction, {});
  const [show, setShow] = useState(false);
  const turnstile = useTurnstile(turnstileSiteKey);
  // A token works once, so every answer from the server starts a new check.
  const answered = useRef(state);
  useEffect(() => {
    if (answered.current === state) return;
    answered.current = state;
    turnstile.spent();
  });
  return (
    <form action={action} className="adm-stack" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error ? (
        <p role="alert" className="adm-field__error">
          {state.error}
        </p>
      ) : null}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        defaultValue={state.email}
        required
        disabled={state.locked}
      />
      <TextField
        label="Password"
        name="password"
        type={show ? 'text' : 'password'}
        autoComplete="current-password"
        required
        disabled={state.locked}
      />
      <div className="adm-row" style={{ justifyContent: 'space-between' }}>
        <Button variant="ghost" aria-pressed={show} onClick={() => setShow((v) => !v)}>
          {show ? 'Hide password' : 'Show password'}
        </Button>
      </div>
      {turnstile.widget}
      <Button
        type="submit"
        variant="primary"
        loading={pending}
        disabled={state.locked}
        disabledReason={
          turnstile.enabled && !turnstile.token ? 'Waiting for the security check' : undefined
        }
      >
        {pending ? 'Signing in' : 'Sign in'}
      </Button>
    </form>
  );
}
