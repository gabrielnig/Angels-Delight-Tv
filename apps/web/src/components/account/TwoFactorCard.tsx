'use client';

import { useState, type FormEvent } from 'react';
import { Button, Modal } from '@ad/ui';
import { msg } from '@ad/shared/messages';
import {
  beginTwoFactorAction,
  confirmTwoFactorAction,
  disableTwoFactorAction,
  regenerateRecoveryAction,
} from '../../app/actions';
import type { AccountRepository, TwoFactorState } from '../../lib/data';
import { AcctField } from './Field';
import { RecoveryCodes } from './RecoveryCodes';

type Begin = Awaited<ReturnType<AccountRepository['beginTwoFactor']>>;
type Confirm = Awaited<ReturnType<AccountRepository['confirmTwoFactor']>>;
type Disable = Awaited<ReturnType<AccountRepository['disableTwoFactor']>>;
type Regenerate = Awaited<ReturnType<AccountRepository['regenerateRecoveryCodes']>>;

type View =
  | { kind: 'off' }
  | { kind: 'setup'; secret: string; qrSvg: string }
  | { kind: 'codes'; codes: string[] }
  | { kind: 'on' };

const qrUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** The Two step verification card of the security screen (S170, S171, S172, S181). */
export function TwoFactorCard({
  initial,
  begin = beginTwoFactorAction,
  confirm = confirmTwoFactorAction,
  disable = disableTwoFactorAction,
  regenerate = regenerateRecoveryAction,
  onChanged,
}: {
  initial: TwoFactorState;
  begin?: () => Promise<Begin>;
  confirm?: (input: { code: string }) => Promise<Confirm>;
  disable?: (input: { password: string; code: string }) => Promise<Disable>;
  regenerate?: (input: { password: string }) => Promise<Regenerate>;
  onChanged?: (change: 'on' | 'off') => void;
}) {
  const [view, setView] = useState<View>(initial.enabled ? { kind: 'on' } : { kind: 'off' });
  const [remaining, setRemaining] = useState(initial.recoveryRemaining);
  const [dialog, setDialog] = useState<'off' | 'regen' | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const low = view.kind === 'on' && remaining <= 2;

  function fail(result: { reason: string; minutes?: number }, wrong: string) {
    setProblem(
      result.reason === 'locked'
        ? msg('account.twoStep.locked', {
            wait: msg('auth.wait.minutes', { count: result.minutes ?? 15 }),
          })
        : result.reason === 'network'
          ? msg('account.twoStep.network')
          : wrong,
    );
  }

  async function start() {
    setBusy(true);
    setProblem(null);
    const result = await begin().catch(() => ({ ok: false as const, reason: 'network' as const }));
    setBusy(false);
    if (result.ok) {
      setCode('');
      setView({ kind: 'setup', secret: result.secret, qrSvg: result.qrSvg });
    } else setProblem(msg('account.twoStep.network'));
  }

  async function submitSetup(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    const result = await confirm({ code: code.trim() }).catch(() => ({
      ok: false as const,
      reason: 'network' as const,
    }));
    setBusy(false);
    if (result.ok) {
      setRemaining(result.recoveryCodes.length);
      setView({ kind: 'codes', codes: result.recoveryCodes });
    } else fail(result, msg('account.twoStep.wrongCode'));
  }

  function closeDialog() {
    setDialog(null);
    setPassword('');
    setCode('');
    setProblem(null);
  }

  async function submitOff(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setProblem(null);
    const result = await disable({ password, code: code.trim() }).catch(() => ({
      ok: false as const,
      reason: 'network' as const,
    }));
    setBusy(false);
    if (result.ok) {
      closeDialog();
      setRemaining(0);
      setView({ kind: 'off' });
      onChanged?.('off');
    } else
      fail(
        result,
        result.reason === 'wrong_password'
          ? msg('account.twoStep.wrongPassword')
          : msg('account.twoStep.wrongCode'),
      );
  }

  async function submitRegen(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setProblem(null);
    const result = await regenerate({ password }).catch(() => ({
      ok: false as const,
      reason: 'network' as const,
    }));
    setBusy(false);
    if (result.ok) {
      closeDialog();
      setRemaining(result.recoveryCodes.length);
      setView({ kind: 'codes', codes: result.recoveryCodes });
    } else fail(result, msg('account.twoStep.wrongPassword'));
  }

  const alert = problem ? (
    <p className="acct-field__error" role="alert">
      <span>{problem}</span>
    </p>
  ) : null;

  return (
    <section className="acct-card" data-gap="2" aria-labelledby="acct-two-step">
      <div className="acct-row" data-between data-wrap data-tight>
        <h2 id="acct-two-step" className="acct-h2">
          {msg('account.twoStep.title')}
        </h2>
        {view.kind === 'on' ? (
          <span className="acct-badge" data-tone="ok">
            {msg('account.twoStep.onBadge')}
          </span>
        ) : null}
      </div>

      {view.kind === 'off' ? (
        <>
          <p className="acct-muted">{msg('account.twoStep.offLead')}</p>
          {alert}
          <div>
            <Button loading={busy} onClick={() => void start()}>
              {msg('account.twoStep.turnOn')}
            </Button>
          </div>
        </>
      ) : null}

      {view.kind === 'setup' ? (
        <form className="acct-form" onSubmit={(e) => void submitSetup(e)} noValidate>
          <p className="acct-muted">{msg('account.twoStep.setupScan')}</p>
          {/* A plain image from a data link: the picture is generated by the server from our own secret. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="acct-qr"
            src={qrUri(view.qrSvg)}
            alt={msg('account.twoStep.qrAlt')}
            width={192}
            height={192}
          />
          <p className="acct-small acct-muted">{msg('account.twoStep.manualKey')}</p>
          <p className="acct-code" data-block>
            {view.secret}
          </p>
          <AcctField
            label={msg('account.twoStep.codeLabel')}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            error={problem ?? undefined}
          />
          <div className="acct-row" data-tight data-wrap>
            <Button type="submit" loading={busy}>
              {msg('account.twoStep.confirm')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setProblem(null);
                setView({ kind: 'off' });
              }}
            >
              {msg('account.twoStep.cancel')}
            </Button>
          </div>
        </form>
      ) : null}

      {view.kind === 'codes' ? (
        <RecoveryCodes
          codes={view.codes}
          onDone={() => {
            setView({ kind: 'on' });
            onChanged?.('on');
          }}
        />
      ) : null}

      {view.kind === 'on' ? (
        <>
          <p className="acct-muted">
            {remaining > 0
              ? msg('account.twoStep.codesLeft', { count: remaining })
              : msg('account.twoStep.noCodes')}
          </p>
          {low ? (
            <p className="acct-notice" data-tone="error">
              <span className="acct-notice__text">{msg('account.twoStep.lowWarning')}</span>
            </p>
          ) : null}
          <div className="acct-row" data-tight data-wrap>
            <Button variant="secondary" onClick={() => setDialog('regen')}>
              {msg('account.twoStep.newCodes')}
            </Button>
            <Button variant="danger-outline" onClick={() => setDialog('off')}>
              {msg('account.twoStep.turnOff')}
            </Button>
          </div>
        </>
      ) : null}

      <Modal
        open={dialog === 'off'}
        onClose={closeDialog}
        title={msg('account.twoStep.turnOffTitle')}
        className="acct-dialog"
        hideClose
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog}>
              {msg('account.twoStep.cancel')}
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void submitOff()}>
              {msg('account.twoStep.turnOff')}
            </Button>
          </>
        }
      >
        <form className="acct-form" onSubmit={(e) => void submitOff(e)} noValidate>
          <p className="acct-muted">{msg('account.twoStep.turnOffLead')}</p>
          <AcctField
            label={msg('account.twoStep.passwordLabel')}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <AcctField
            label={msg('account.twoStep.anyCodeLabel')}
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {alert}
        </form>
      </Modal>

      <Modal
        open={dialog === 'regen'}
        onClose={closeDialog}
        title={msg('account.twoStep.newCodesTitle')}
        className="acct-dialog"
        hideClose
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog}>
              {msg('account.twoStep.cancel')}
            </Button>
            <Button loading={busy} onClick={() => void submitRegen()}>
              {msg('account.twoStep.newCodes')}
            </Button>
          </>
        }
      >
        <form className="acct-form" onSubmit={(e) => void submitRegen(e)} noValidate>
          <p className="acct-muted">{msg('account.twoStep.newCodesLead')}</p>
          <AcctField
            label={msg('account.twoStep.passwordLabel')}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {alert}
        </form>
      </Modal>
    </section>
  );
}
