'use client';

import { useState } from 'react';
import type { FieldResult } from '@/lib/data/admin/account-commands';
import type { SecurityInfo } from '@/lib/data/admin/types';
import { Badge } from './Badge';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { TextField } from './fields';
import { Banner } from './states';
import { useToast } from './Toast';

type Failure = { ok: false; field: string; error: string };

export interface SecurityActions {
  sendTestCode?(): Promise<FieldResult>;
  confirmTestCode?(code: string): Promise<FieldResult>;
  switchToEmail?(input: { password?: string; code?: string; emailCode?: string }): Promise<FieldResult>;
  beginAuthenticator?(password: string): Promise<{ ok: true; secret: string; qrSvg: string } | Failure>;
  finishAuthenticator?(code: string): Promise<{ ok: true; codes: string[] } | Failure>;
}

const GENERIC = 'That did not work. Nothing was changed. Try again.';

/**
 * The second step on My account (L16b): shows the method in use and moves between emailed codes and an authenticator
 * app. Moving to email needs a working test code first, so nobody is left without a way in.
 */
export function SecuritySection({
  security,
  actions,
  onChanged,
}: {
  security: SecurityInfo;
  actions: SecurityActions;
  onChanged: () => void;
}) {
  const onEmail = security.method === 'email';
  const [open, setOpen] = useState(false);
  const canSwitch = onEmail ? Boolean(actions.beginAuthenticator) : Boolean(actions.switchToEmail);
  return (
    <>
      <div className="adm-row">
        <Badge tone="success" icon="shield">
          {onEmail ? 'Emailed code' : 'Authenticator app'}
        </Badge>
      </div>
      {canSwitch ? (
        <div>
          <Button onClick={() => setOpen(true)}>
            {onEmail ? 'Switch to an authenticator app' : 'Switch to emailed codes'}
          </Button>
        </div>
      ) : null}
      {onEmail ? (
        <ToAuthenticator
          open={open}
          actions={actions}
          onClose={() => setOpen(false)}
          onChanged={() => {
            setOpen(false);
            onChanged();
          }}
        />
      ) : (
        <ToEmail
          open={open}
          security={security}
          actions={actions}
          onClose={() => setOpen(false)}
          onChanged={() => {
            setOpen(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function ToEmail({
  open,
  security,
  actions,
  onClose,
  onChanged,
}: {
  open: boolean;
  security: SecurityInfo;
  actions: SecurityActions;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<'password' | 'email'>('password');
  const [tested, setTested] = useState(security.testedRecently);
  const [testSent, setTestSent] = useState(false);
  const [testCode, setTestCode] = useState('');
  const [password, setPassword] = useState('');
  const [appCode, setAppCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function run(key: string, work: () => Promise<FieldResult>, done: () => void) {
    setBusy(key);
    setErrors({});
    try {
      const result = await work();
      if (result.ok) done();
      else setErrors({ [result.field]: result.error });
    } catch {
      setErrors({ form: GENERIC });
    } finally {
      setBusy(null);
    }
  }

  const sendCode = () =>
    run('send', () => actions.sendTestCode!(), () => {
      setTestSent(true);
      toast.show({ tone: 'success', message: 'Code sent. Check your email.' });
    });
  const checkTest = () =>
    run('check', () => actions.confirmTestCode!(testCode), () => {
      setTested(true);
      setTestCode('');
    });
  const doSwitch = () =>
    run(
      'switch',
      () =>
        actions.switchToEmail!(mode === 'email' ? { emailCode } : { password, code: appCode }),
      () => {
        toast.show({ tone: 'success', message: 'You will use emailed codes from now on.' });
        onChanged();
      },
    );

  if (!security.canUseEmail) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Emailed codes are not available"
        size="sm"
        footer={<Button variant="primary" onClick={onClose}>Close</Button>}
      >
        <Banner tone="warning">{security.blocker ?? 'Emailed codes cannot be used right now.'}</Banner>
      </Dialog>
    );
  }

  const ready = mode === 'email' ? emailCode.trim() !== '' : tested && password !== '' && appCode.trim() !== '';
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Switch to emailed codes?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy === 'switch'}
            disabledReason={ready ? undefined : mode === 'email' ? 'Enter the emailed code first' : tested ? 'Enter your password and code first' : 'Test your email first'}
            onClick={() => void doSwitch()}
          >
            Switch to emailed codes
          </Button>
        </>
      }
    >
      <p style={{ margin: 0 }}>
        Your authenticator app and its recovery codes stop working, and you are signed out on your
        other devices. We email you a code each time you sign in, so your inbox must be safe.
      </p>
      {errors.form ? (
        <p role="alert" className="adm-field__error">
          {errors.form}
        </p>
      ) : null}
      {mode === 'password' ? (
        <>
          <div className="adm-stack" aria-live="polite">
            <h3 className="adm-h4">1. Test your email</h3>
            {tested ? (
              <Badge tone="success" icon="check">
                Your email works.
              </Badge>
            ) : (
              <>
                <p className="adm-muted" style={{ margin: 0 }}>
                  We send a code to your email address. Enter it here to show it reaches you.
                </p>
                <div>
                  <Button loading={busy === 'send'} onClick={() => void sendCode()}>
                    {testSent ? 'Send a new code' : 'Send test code'}
                  </Button>
                </div>
                {testSent ? (
                  <>
                    <TextField
                      label="Test code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={7}
                      value={testCode}
                      error={errors.code}
                      onChange={(e) => setTestCode(e.target.value)}
                    />
                    <div>
                      <Button loading={busy === 'check'} onClick={() => void checkTest()}>
                        Check code
                      </Button>
                    </div>
                  </>
                ) : errors.code ? (
                  <p role="alert" className="adm-field__error">
                    {errors.code}
                  </p>
                ) : null}
              </>
            )}
          </div>
          <div className="adm-stack">
            <h3 className="adm-h4">2. Confirm it is you</h3>
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              error={errors.password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <TextField
              label="Authenticator code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={appCode}
              error={tested ? errors.code : undefined}
              onChange={(e) => setAppCode(e.target.value)}
            />
          </div>
          <div>
            <Button
              variant="ghost"
              onClick={() => {
                setMode('email');
                setErrors({});
              }}
            >
              Confirm with an emailed code instead
            </Button>
          </div>
        </>
      ) : (
        <div className="adm-stack">
          <p className="adm-muted" style={{ margin: 0 }}>
            We send a code to your email address. A right code also proves your email works.
          </p>
          <div>
            <Button loading={busy === 'send'} onClick={() => void sendCode()}>
              {testSent ? 'Send a new code' : 'Send code'}
            </Button>
          </div>
          <TextField
            label="Emailed code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={emailCode}
            error={errors.code}
            onChange={(e) => setEmailCode(e.target.value)}
          />
          <div>
            <Button
              variant="ghost"
              onClick={() => {
                setMode('password');
                setErrors({});
              }}
            >
              Use my password and authenticator code instead
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function ToAuthenticator({
  open,
  actions,
  onClose,
  onChanged,
}: {
  open: boolean;
  actions: SecurityActions;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [step, setStep] = useState<'password' | 'scan' | 'codes'>('password');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  function close() {
    const finished = step === 'codes';
    setStep('password');
    setPassword('');
    setCode('');
    setSetup(null);
    setCodes([]);
    setError(undefined);
    if (finished) onChanged();
    else onClose();
  }

  async function begin() {
    setBusy(true);
    setError(undefined);
    try {
      const result = await actions.beginAuthenticator!(password);
      if (result.ok) {
        setSetup({ secret: result.secret, qrSvg: result.qrSvg });
        setPassword('');
        setStep('scan');
      } else setError(result.error);
    } catch {
      setError(GENERIC);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError(undefined);
    try {
      const result = await actions.finishAuthenticator!(code);
      if (result.ok) {
        setCodes(result.codes);
        setStep('codes');
      } else setError(result.error);
    } catch {
      setError(GENERIC);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={step === 'codes' ? 'Your recovery codes' : 'Switch to an authenticator app'}
      size="sm"
      footer={
        step === 'codes' ? (
          <Button variant="primary" onClick={close}>
            I have saved them
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            {step === 'password' ? (
              <Button
                variant="primary"
                loading={busy}
                disabledReason={password ? undefined : 'Enter your password first'}
                onClick={() => void begin()}
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="primary"
                loading={busy}
                disabledReason={code.trim() ? undefined : 'Enter the code from your app first'}
                onClick={() => void finish()}
              >
                Turn on authenticator app
              </Button>
            )}
          </>
        )
      }
    >
      {step === 'password' ? (
        <>
          <p style={{ margin: 0 }}>
            Enter your password to begin. Emailed codes and remembered devices stop when you finish.
          </p>
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            error={error}
            onChange={(e) => setPassword(e.target.value)}
          />
        </>
      ) : step === 'scan' && setup ? (
        <>
          <div
            role="img"
            aria-label="QR code for your authenticator app"
            // nosemgrep: react-dangerouslysetinnerhtml (SVG from our own QR encoder, no user input)
            dangerouslySetInnerHTML={{ __html: setup.qrSvg }}
          />
          <p className="adm-muted" style={{ margin: 0 }}>
            Cannot scan? Enter this key in your app: <code>{setup.secret}</code>
          </p>
          <TextField
            label="6 digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            error={error}
            onChange={(e) => setCode(e.target.value)}
          />
        </>
      ) : (
        <>
          <Banner tone="warning">
            These are shown once. Each code works one time. Keep them somewhere safe.
          </Banner>
          <ul className="adm-codes" aria-label="Recovery codes">
            {codes.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
          <div>
            <Button
              icon="copy"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(codes.join('\n'))
                  .then(() => toast.show({ message: 'Codes copied.' }))
              }
            >
              Copy codes
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
