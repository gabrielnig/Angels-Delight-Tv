'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { msg } from '@ad/shared/messages';
import { AuthBanner, AuthField, AuthSubmit } from './AuthParts';

export type LinkResult =
  | { ok: true; next: string }
  | { ok: false; reason: 'wrong' | 'expired' | 'network' }
  | { ok: false; reason: 'locked'; minutes: number };

type State =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'wrong' }
  | { kind: 'expired' }
  | { kind: 'network' }
  | { kind: 'locked'; minutes: number };

/**
 * "Link Google to your account" (S173 states 4 to 6). An account with this email already exists and is verified, so
 * nothing is linked until its password is given once. Wrong passwords count toward the normal lockout.
 */
export function LinkGoogleForm({
  hint,
  onConfirm,
  onDone,
}: {
  hint: string;
  onConfirm: (password: string) => Promise<LinkResult>;
  onDone: (next: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password || state.kind === 'busy' || state.kind === 'locked') return;
    setState({ kind: 'busy' });
    try {
      const result = await onConfirm(password);
      if (result.ok) {
        onDone(result.next);
        return;
      }
      setState(
        result.reason === 'locked'
          ? { kind: 'locked', minutes: result.minutes }
          : { kind: result.reason },
      );
    } catch {
      setState({ kind: 'network' });
    }
  }

  const problem =
    state.kind === 'wrong'
      ? msg('auth.google.linkWrong')
      : state.kind === 'locked'
        ? msg('auth.google.linkLocked', {
            wait: msg('auth.wait.minutes', { count: state.minutes }),
          })
        : state.kind === 'network'
          ? msg('auth.google.linkNetwork')
          : null;

  if (state.kind === 'expired') {
    return (
      <div className="web-form">
        <AuthBanner tone="danger">{msg('auth.google.linkExpired')}</AuthBanner>
        <Link
          href="/sign-in"
          className="ad-btn"
          data-variant="primary"
          data-size="lg"
          data-full="true"
        >
          {msg('auth.google.failedAction')}
        </Link>
      </div>
    );
  }

  return (
    <div className="web-form">
      <h1 className="web-auth__title">{msg('auth.google.linkTitle')}</h1>
      <p className="web-muted">
        {msg('auth.google.linkLeadBefore')} <strong>{hint}</strong>.{' '}
        {msg('auth.google.linkLeadAfter')}
      </p>
      <form className="web-form" noValidate onSubmit={(event) => void submit(event)}>
        {problem ? <AuthBanner tone="danger">{problem}</AuthBanner> : null}
        <AuthField
          label={msg('auth.google.linkPassword')}
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (state.kind === 'wrong') setState({ kind: 'idle' });
          }}
          disabled={state.kind === 'locked'}
          invalid={state.kind === 'wrong'}
          autoFocus
        />
        <AuthSubmit loading={state.kind === 'busy'} disabled={state.kind === 'locked'}>
          {msg('auth.google.linkSubmit')}
        </AuthSubmit>
      </form>
      <Link href="/forgot-password" className="auth-link">
        {msg('auth.google.linkForgot')}
      </Link>
      <Link href="/sign-in" className="auth-link">
        {msg('auth.google.cancel')}
      </Link>
    </div>
  );
}
