'use client';

import { useT } from '../../lib/i18n/provider';
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
  const msg = useT();
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
      ? msg('auth.thatCodeIsNot')
      : state.kind === 'expired'
        ? msg('auth.thisCodeHasExpired')
        : state.kind === 'too_many'
          ? msg('auth.tooManyWrongCodes', { minutes: state.minutes })
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
        ? msg('auth.weSentANew')
        : result.reason === 'resend_limit'
          ? msg('auth.youHaveAskedFor')
          : NETWORK_MESSAGE,
    );
  }

  return (
    <div className="web-form">
      <p className="web-muted">
        {msg('auth.weSentA6')} <strong>{maskedEmail}</strong>
        {msg('auth.enterItBelow')}
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
        <Banner tone="success">{msg('auth.emailConfirmedTakingYou')}</Banner>
      ) : null}
      {resendNote ? <Banner tone="info">{resendNote}</Banner> : null}
      <div className="web-form__center">
        <ResendCode
          key={`${resendKey}-${state.kind === 'expired' || state.kind === 'too_many' ? 'now' : 'wait'}`}
          seconds={state.kind === 'expired' || state.kind === 'too_many' ? 0 : resendSeconds}
          onResend={() => void resend()}
        />
        <Link href="/sign-up" className="web-link">
          {msg('auth.changeEmail')}
        </Link>
      </div>
    </div>
  );
}
