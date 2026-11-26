'use client';

import { checkPassword } from '@ad/auth/policy';
import { useState } from 'react';
import type { FieldResult } from '@/lib/data/admin/account-commands';
import { formatRelative } from '@/lib/admin/format';
import type { MyAccount } from '@/lib/data/admin/types';
import { Badge } from './Badge';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { TextField } from './fields';
import { Icon } from './Icon';
import { Banner } from './states';
import { useToast } from './Toast';
import { useRouter } from 'next/navigation';

export interface AccountActions {
  updateName(name: string): Promise<FieldResult>;
  changePassword(
    current: string,
    next: string,
    confirm: string,
    code: string,
  ): Promise<FieldResult>;
  revokeSession(id: string): Promise<FieldResult>;
  regenerateCodes(
    code: string,
  ): Promise<{ ok: false; field: string; error: string } | { ok: true; codes: string[] }>;
  /** Emails a fresh confirmation code. Only for people who use emailed codes. */
  sendConfirmCode?(): Promise<FieldResult>;
  revokeTrustedDevice?(id: string): Promise<FieldResult>;
  switchToEmail?(code: string): Promise<FieldResult>;
}

export function MyAccountView({
  account,
  roleLabel,
  now,
  actions,
}: {
  account: MyAccount;
  roleLabel: string;
  now: number;
  actions: AccountActions;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(account.name);
  const [nameError, setNameError] = useState<string>();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordCode, setPasswordCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [codesOpen, setCodesOpen] = useState(false);
  const [codeValue, setCodeValue] = useState('');
  const [codeError, setCodeError] = useState<string>();
  const [codes, setCodes] = useState<string[] | null>(null);
  const check = checkPassword(next, account.email);
  const emailMode = account.secondStep === 'email';
  const [codeNotice, setCodeNotice] = useState<string>();
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchCode, setSwitchCode] = useState('');
  const [switchError, setSwitchError] = useState<string>();

  async function guard<T>(key: string, work: () => Promise<T>): Promise<T | null> {
    setBusy(key);
    try {
      return await work();
    } catch {
      toast.show({ tone: 'danger', message: 'That did not work. Nothing was changed. Try again.' });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const r = await guard('name', () => actions.updateName(name));
    if (!r) return;
    setNameError(r.ok ? undefined : r.error);
    if (r.ok) {
      toast.show({ tone: 'success', message: 'Name saved.' });
      router.refresh();
    }
  }
  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    const r = await guard('password', () =>
      actions.changePassword(cur, next, confirm, passwordCode),
    );
    if (!r) return;
    if (r.ok) {
      setErrors({});
      setCur('');
      setNext('');
      setConfirm('');
      setPasswordCode('');
      toast.show({
        tone: 'success',
        message: 'Password changed. Your other devices were signed out.',
      });
      router.refresh();
    } else setErrors({ [r.field]: r.error });
  }
  async function makeCodes() {
    const r = await guard('codes', () => actions.regenerateCodes(codeValue));
    if (!r) return;
    if (r.ok) {
      setCodes(r.codes);
      setCodeValue('');
      setCodeError(undefined);
      router.refresh();
    } else setCodeError(r.error);
  }
  async function emailMeACode() {
    const r = await guard('send', () => actions.sendConfirmCode!());
    if (!r) return;
    if (r.ok) {
      setErrors({});
      setCodeNotice('A code is on its way. Check your email, then enter it here.');
    } else setErrors({ code: r.error });
  }
  async function switchToEmail() {
    const r = await guard('switch', () => actions.switchToEmail!(switchCode.replace(/\s/g, '')));
    if (!r) return;
    if (r.ok) {
      setSwitchOpen(false);
      setSwitchCode('');
      toast.show({ tone: 'success', message: 'You will use emailed codes from now on.' });
      router.refresh();
    } else setSwitchError(r.error);
  }
  const closeCodes = () => {
    setCodesOpen(false);
    setCodes(null);
    setCodeValue('');
    setCodeError(undefined);
  };

  return (
    <div className="adm-stack">
      <section className="adm-card adm-stack" aria-labelledby="acc-profile">
        <h2 className="adm-h3" id="acc-profile">
          Profile
        </h2>
        <form className="adm-stack" onSubmit={saveName} noValidate>
          <TextField
            label="Display name"
            value={name}
            maxLength={60}
            autoComplete="name"
            error={nameError}
            onChange={(e) => setName(e.target.value)}
          />
          <dl className="adm-dl">
            <div>
              <dt>Email</dt>
              <dd>{account.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{roleLabel}</dd>
            </div>
          </dl>
          <div>
            <Button
              type="submit"
              variant="primary"
              loading={busy === 'name'}
              disabled={name === account.name}
            >
              Save name
            </Button>
          </div>
        </form>
      </section>

      <section className="adm-card adm-stack" aria-labelledby="acc-password">
        <h2 className="adm-h3" id="acc-password">
          Password
        </h2>
        {account.passwordChangedAt ? (
          <p className="adm-muted" style={{ margin: 0 }}>
            Last changed {formatRelative(account.passwordChangedAt, now)}.
          </p>
        ) : null}
        <form className="adm-stack" onSubmit={savePassword} noValidate>
          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={cur}
            error={errors.current}
            onChange={(e) => setCur(e.target.value)}
          />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            value={next}
            error={errors.next}
            onChange={(e) => setNext(e.target.value)}
          />
          <ul className="adm-rules" aria-label="Password rules">
            {check.rules.map((rule) => (
              <li key={rule.id}>
                <Icon
                  name={rule.passed ? 'check' : rule.passed === false ? 'alert' : 'info'}
                  size={16}
                />
                <span>{rule.label}</span>
                <span className="adm-sr">
                  {rule.passed ? ', done' : rule.passed === false ? ', not met' : ''}
                </span>
              </li>
            ))}
          </ul>
          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            error={errors.confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <TextField
            label={emailMode ? 'Emailed code' : 'Authenticator code'}
            hint={
              emailMode
                ? 'The 6 digit code we email you. Use Email me a code to get one.'
                : 'The 6 digit code from your authenticator app.'
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            value={passwordCode}
            error={errors.code}
            onChange={(e) => setPasswordCode(e.target.value)}
          />
          {emailMode && actions.sendConfirmCode ? (
            <div>
              <Button loading={busy === 'send'} onClick={() => void emailMeACode()}>
                Email me a code
              </Button>
              <p role="status" className="adm-muted" style={{ margin: 0 }}>
                {codeNotice}
              </p>
            </div>
          ) : null}
          <div>
            <Button
              type="submit"
              variant="primary"
              loading={busy === 'password'}
              disabled={!cur || !next || !confirm || !passwordCode.trim()}
            >
              Change password
            </Button>
          </div>
        </form>
        <p className="adm-muted" style={{ margin: 0 }}>
          Changing your password signs you out on your other devices.
        </p>
      </section>

      <section className="adm-card adm-stack" aria-labelledby="acc-2fa">
        <h2 className="adm-h3" id="acc-2fa">
          Two step sign in
        </h2>
        {emailMode ? (
          <>
            <div className="adm-row">
              <Badge tone="success" icon="shield">
                Emailed code
              </Badge>
            </div>
            <p className="adm-muted" style={{ margin: 0 }}>
              After your password we email you a code. There are no recovery codes: your inbox is the
              fallback, so keep that account secure.
            </p>
          </>
        ) : (
          <>
            <div className="adm-row">
              <Badge
                tone={account.twoFactor ? 'success' : 'warning'}
                icon={account.twoFactor ? 'shield' : 'alert'}
              >
                {account.twoFactor ? 'Authenticator app' : 'Not set up'}
              </Badge>
              <span className="adm-muted">{account.recoveryCodesLeft} recovery codes left</span>
            </div>
            {account.recoveryCodesLeft <= 3 ? (
              <Banner tone="warning">
                You are running low on recovery codes. Make new ones and keep them somewhere safe.
              </Banner>
            ) : null}
            <div className="adm-row">
              <Button onClick={() => setCodesOpen(true)}>Make new recovery codes</Button>
              {account.emailSwitchAvailable && actions.switchToEmail ? (
                <Button onClick={() => setSwitchOpen(true)}>Use emailed codes instead</Button>
              ) : null}
            </div>
          </>
        )}
      </section>

      {account.trustedDevices && account.trustedDevices.length > 0 ? (
        <section className="adm-card adm-stack" aria-labelledby="acc-trusted">
          <h2 className="adm-h3" id="acc-trusted">
            Remembered devices
          </h2>
          <p className="adm-muted" style={{ margin: 0 }}>
            These browsers skip the emailed code until they expire. Forget any you do not use or no
            longer trust. Signing out everywhere and changing your password forget them all.
          </p>
          <ul className="adm-list">
            {account.trustedDevices.map((device) => (
              <li key={device.id}>
                <span className="adm-listrow__main">
                  <strong>{device.label}</strong>
                  <span className="adm-muted">
                    {device.place}, {device.lastUsedAt ? `used ${formatRelative(device.lastUsedAt, now)}` : 'not used since'}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  loading={busy === device.id}
                  aria-label={`Forget ${device.label}`}
                  onClick={async () => {
                    const r = await guard(device.id, () => actions.revokeTrustedDevice!(device.id));
                    if (r) {
                      toast.show(
                        r.ok
                          ? { tone: 'success', message: 'Device forgotten.' }
                          : { tone: 'danger', message: r.error },
                      );
                      if (r.ok) router.refresh();
                    }
                  }}
                >
                  Forget
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="adm-card adm-stack" aria-labelledby="acc-sessions">
        <h2 className="adm-h3" id="acc-sessions">
          Where you are signed in
        </h2>
        <ul className="adm-list">
          {account.sessions.map((s) => (
            <li key={s.id}>
              <span className="adm-listrow__main">
                <strong>{s.device}</strong>
                <span className="adm-muted">
                  {s.place}, {s.current ? 'active now' : formatRelative(s.lastActiveAt, now)}
                </span>
                {s.current ? (
                  <Badge tone="success" icon="check">
                    This device
                  </Badge>
                ) : null}
              </span>
              {!s.current ? (
                <Button
                  variant="ghost"
                  loading={busy === s.id}
                  aria-label={`Sign out ${s.device}`}
                  onClick={async () => {
                    const r = await guard(s.id, () => actions.revokeSession(s.id));
                    if (r) {
                      toast.show(
                        r.ok
                          ? { tone: 'success', message: 'Signed out.' }
                          : { tone: 'danger', message: r.error },
                      );
                      if (r.ok) router.refresh();
                    }
                  }}
                >
                  Sign out
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <Dialog
        open={switchOpen}
        onClose={() => {
          setSwitchOpen(false);
          setSwitchCode('');
          setSwitchError(undefined);
        }}
        title="Use emailed codes instead?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSwitchOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy === 'switch'} onClick={() => void switchToEmail()}>
              Switch to emailed codes
            </Button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          Your authenticator app and recovery codes stop working and you are signed out on your other
          devices. Enter the 6 digit code from your app to confirm.
        </p>
        <TextField
          label="Authenticator code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={switchCode}
          error={switchError}
          onChange={(e) => setSwitchCode(e.target.value)}
        />
      </Dialog>

      <Dialog
        open={codesOpen}
        onClose={closeCodes}
        title={codes ? 'Your new recovery codes' : 'Make new recovery codes?'}
        size="sm"
        footer={
          codes ? (
            <Button variant="primary" onClick={closeCodes}>
              I have saved them
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={closeCodes}>
                Cancel
              </Button>
              <Button variant="primary" loading={busy === 'codes'} onClick={makeCodes}>
                Make new codes
              </Button>
            </>
          )
        }
      >
        {codes ? (
          <>
            <Banner tone="warning">
              These are shown once. Each code works one time. Your old codes no longer work.
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
        ) : (
          <>
            <p style={{ margin: 0 }}>
              Your old codes stop working. Enter the 6 digit code from your authenticator app to
              continue.
            </p>
            <TextField
              label="Authenticator code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={codeValue}
              error={codeError}
              onChange={(e) => setCodeValue(e.target.value)}
            />
          </>
        )}
      </Dialog>
    </div>
  );
}
