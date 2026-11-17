'use client';

import { useState } from 'react';
import { Banner, Link, OtpInput, ResendCode } from '@ad/ui';
import type { CodeResult } from '../../lib/data';
import { NETWORK_MESSAGE } from './shared';

type State =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'success' }
  | { kind: 'wrong' }
  | { kind: 'expired' }
  | { kind: 'too_many'; minutes: number }
  | { kind: 'network' };

export function VerifyEmailForm({
  maskedEmail,
  onSubmit,
  onResend,
  onDone,
  resendSeconds = 30,
}: {
  maskedEmail: string;
  onSubmit: (input: { code: string }) => Promise<CodeResult>;
  onResend: () => Promise<{ ok: true } | { ok: false; reason: 'resend_limit' | 'network' }>;
  onDone: (next: string) => void;
  resendSeconds?: number;
}) {
  const [code, setCode] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [resendKey, setResendKey] = useState(0);
  const [resendNote, setResendNote] = useState<string | null>(null);

  async function submit(value: string) {
    setState({ kind: 'busy' });
    try {
      const result = await onSubmit({ code: value });
      if (result.ok) {
        setState({ kind: 'success' });
        onDone(result.next);
        return;
      }
      if (result.reason === 'too_many') setState({ kind: 'too_many', minutes: result.minutes });
      else if (result.reason === 'expired') setState({ kind: 'expired' });
      else if (result.reason === 'network' || result.reason === 'resend_limit')
        setState({ kind: 'network' });
      else setState({ kind: 'wrong' });
    } catch {
      setState({ kind: 'network' });
    }
  }

  const error =
    state.kind === 'wrong'
      ? 'That code is not right. Check it and try again.'
      : state.kind === 'expired'
        ? 'This code has expired. Send a new code to continue.'
        : state.kind === 'too_many'
          ? `Too many wrong codes. Try again in ${state.minutes} minutes, or change your email.`
          : state.kind === 'network'
            ? NETWORK_MESSAGE
            : undefined;

  async function resend() {
    const result = await onResend().catch(() => ({
      ok: false as const,
      reason: 'network' as const,
    }));
    setCode('');
    setState({ kind: 'idle' });
    setResendKey((key) => key + 1);
    setResendNote(
      result.ok
        ? 'We sent a new code.'
        : result.reason === 'resend_limit'
          ? 'You have asked for too many codes. Try again in an hour.'
          : NETWORK_MESSAGE,
    );
  }

  return (
    <div className="web-form">
      <p className="web-muted">
        We sent a 6 digit code to <strong>{maskedEmail}</strong>. Enter it below.
      </p>
      <OtpInput
        value={code}
        onChange={(value) => {
          setCode(value);
          if (state.kind === 'wrong') setState({ kind: 'idle' });
        }}
        onComplete={(value) => void submit(value)}
        error={error}
        loading={state.kind === 'busy'}
        success={state.kind === 'success'}
        disabled={state.kind === 'too_many'}
        autoFocus
      />
      {state.kind === 'success' ? (
        <Banner tone="success">Email confirmed. Taking you to choose a profile.</Banner>
      ) : null}
      {resendNote ? <Banner tone="info">{resendNote}</Banner> : null}
      <div className="web-form__center">
        <ResendCode
          key={`${resendKey}-${state.kind === 'expired' || state.kind === 'too_many' ? 'now' : 'wait'}`}
          seconds={state.kind === 'expired' || state.kind === 'too_many' ? 0 : resendSeconds}
          onResend={() => void resend()}
        />
        <Link href="/sign-up" className="web-link">
          Change email
        </Link>
      </div>
    </div>
  );
}
