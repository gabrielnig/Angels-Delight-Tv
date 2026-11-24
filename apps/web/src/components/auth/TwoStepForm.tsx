'use client';

import { useState, type FormEvent } from 'react';
import { Link, OtpInput } from '@ad/ui';
import { msg } from '@ad/shared/messages';
import type { TwoStepResult } from '../../lib/data';
import { AuthBanner, AuthField, AuthSubmit } from './AuthParts';

type State =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done' }
  | { kind: 'wrong' }
  | { kind: 'expired' }
  | { kind: 'locked'; minutes: number }
  | { kind: 'network' };

const CODE_LABEL = msg('auth.twoStep.codeLabel');
const RECOVERY_LABEL = msg('auth.twoStep.recoveryLabel');

/** The second sign in step (S172): an authenticator code, or one recovery code. No session exists before it passes. */
export function TwoStepForm({
  onVerify,
  onRecover,
  onDone,
  supportEmail,
}: {
  onVerify: (code: string) => Promise<TwoStepResult>;
  onRecover: (code: string) => Promise<TwoStepResult>;
  onDone: (next: string) => void;
  supportEmail?: string;
}) {
  const [mode, setMode] = useState<'code' | 'recovery'>('code');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function run(task: Promise<TwoStepResult>) {
    setState({ kind: 'busy' });
    try {
      const result = await task;
      if (result.ok) {
        setState({ kind: 'done' });
        onDone(result.next);
        return;
      }
      if (result.reason === 'locked') setState({ kind: 'locked', minutes: result.minutes });
      else if (result.reason === 'expired') setState({ kind: 'expired' });
      else if (result.reason === 'network') setState({ kind: 'network' });
      else setState({ kind: 'wrong' });
    } catch {
      setState({ kind: 'network' });
    }
  }

  function switchTo(next: 'code' | 'recovery') {
    setMode(next);
    setState({ kind: 'idle' });
    setCode('');
    setRecovery('');
  }

  const problem =
    state.kind === 'wrong'
      ? mode === 'code'
        ? msg('auth.twoStep.wrong')
        : msg('auth.twoStep.recoveryWrong')
      : state.kind === 'locked'
        ? msg('auth.twoStep.locked', {
            wait: msg('auth.wait.minutes', { count: state.minutes }),
          })
        : state.kind === 'network'
          ? msg('auth.twoStep.network')
          : undefined;

  if (state.kind === 'expired') {
    return (
      <div className="web-form">
        <AuthBanner tone="danger">{msg('auth.twoStep.expired')}</AuthBanner>
        <Link
          href="/sign-in"
          className="ad-btn"
          data-variant="primary"
          data-size="lg"
          data-full="true"
        >
          {msg('auth.twoStep.expiredAction')}
        </Link>
      </div>
    );
  }

  const lost = supportEmail
    ? msg('auth.twoStep.lostWith', { email: supportEmail })
    : msg('auth.twoStep.lost');

  return (
    <div className="web-form">
      <p className="web-muted">{msg('auth.twoStep.lead')}</p>
      {mode === 'code' ? (
        <OtpInput
          value={code}
          label={CODE_LABEL}
          onChange={(value) => {
            setCode(value);
            if (state.kind === 'wrong') setState({ kind: 'idle' });
          }}
          onComplete={(value) => void run(onVerify(value))}
          error={problem}
          loading={state.kind === 'busy'}
          success={state.kind === 'done'}
          disabled={state.kind === 'locked'}
          autoFocus
        />
      ) : (
        <form
          className="web-form"
          noValidate
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            if (recovery.trim()) void run(onRecover(recovery.trim()));
          }}
        >
          <AuthField
            label={RECOVERY_LABEL}
            hint={msg('auth.twoStep.recoveryHint')}
            error={problem}
            value={recovery}
            onChange={(event) => setRecovery(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={state.kind === 'locked'}
            className="auth-input--mono"
            autoFocus
          />
          <AuthSubmit loading={state.kind === 'busy'} disabled={state.kind === 'locked'}>
            {msg('auth.twoStep.recoverySubmit')}
          </AuthSubmit>
        </form>
      )}
      <div className="web-form__center">
        <button
          type="button"
          className="web-link"
          onClick={() => switchTo(mode === 'code' ? 'recovery' : 'code')}
        >
          {mode === 'code' ? msg('auth.twoStep.useRecovery') : msg('auth.twoStep.useApp')}
        </button>
      </div>
      <p className="web-muted">{lost}</p>
    </div>
  );
}
