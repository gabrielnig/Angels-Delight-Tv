'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { msg } from '@ad/shared/messages';
import { AuthBanner, AuthSubmit } from './AuthParts';

export type FinishResult =
  { ok: true; next: string } | { ok: false; reason: 'expired' | 'network' | 'fields' | 'locked' };

/**
 * "Finish setting up" (S173 state 8). Google gave a verified address that matches no account, so one step of
 * terms and age consent comes before the account exists. The statement stands in for the checkboxes, the same
 * way it does on the email sign up screen.
 */
export function FinishGoogleSignUp({
  hint,
  onFinish,
  onDone,
}: {
  hint: string;
  onFinish: () => Promise<FinishResult>;
  onDone: (next: string) => void;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'expired' | 'network'>('idle');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (state === 'busy') return;
    setState('busy');
    try {
      const result = await onFinish();
      if (result.ok) {
        onDone(result.next);
        return;
      }
      setState(result.reason === 'expired' ? 'expired' : 'network');
    } catch {
      setState('network');
    }
  }

  if (state === 'expired') {
    return (
      <div className="web-form">
        <AuthBanner tone="danger">{msg('auth.google.finishExpired')}</AuthBanner>
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
      <h1 className="web-auth__title">{msg('auth.google.finishTitle')}</h1>
      <p className="web-muted">
        {msg('auth.google.finishLeadBefore')} <strong>{hint}</strong>.{' '}
        {msg('auth.google.finishLeadAfter')}
      </p>
      <p className="auth-fine">{msg('auth.google.finishTerms')}</p>
      <form className="web-form" noValidate onSubmit={(event) => void submit(event)}>
        {state === 'network' ? (
          <AuthBanner tone="danger">{msg('auth.google.linkNetwork')}</AuthBanner>
        ) : null}
        <AuthSubmit loading={state === 'busy'}>{msg('auth.google.finishSubmit')}</AuthSubmit>
      </form>
      <Link href="/sign-in" className="auth-link">
        {msg('auth.google.cancel')}
      </Link>
    </div>
  );
}
