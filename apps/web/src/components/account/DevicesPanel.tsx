'use client';

import { useT } from '../../lib/i18n/provider';
import { useState } from 'react';
import { Button, Modal } from '@ad/ui';
import type { DeviceKind, DeviceSession } from '../../lib/data';
import { AcctField } from './Field';
import { AcctIcon, type AcctIconName } from './icons';

export type SignOutEverywhereResult =
  | { ok: true }
  | { ok: false; reason: 'wrong_password' | 'network' }
  | { ok: false; reason: 'locked'; minutes: number };

const KIND_ICON: Record<DeviceKind, AcctIconName | null> = {
  tv: 'tv',
  tablet: 'tablet',
  phone: 'phone',
  computer: 'laptop',
  other: null,
};

function iconFor(device: DeviceSession): AcctIconName {
  const byKind = device.kind ? KIND_ICON[device.kind] : null;
  return byKind ?? (isDesktop(device.label) ? 'laptop' : 'phone');
}

const isDesktop = (label: string) => /windows|mac|linux|chromebook|desktop/i.test(label);

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Signed in devices (S28). Pure view: the page owns the list and the toasts. */
export function DevicesCard({
  devices,
  onRevoke,
  onRevokeOthers,
  onSignOutEverywhere,
}: {
  devices: DeviceSession[];
  onRevoke: (id: string) => void | Promise<void>;
  onRevokeOthers: () => void | Promise<void>;
  /** When given, the card offers Sign out everywhere, which asks for the password and includes this device. */
  onSignOutEverywhere?: (password: string) => Promise<SignOutEverywhereResult>;
}) {
  const msg = useT();
  const [confirming, setConfirming] = useState(false);
  const [everywhere, setEverywhere] = useState(false);
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  function closeEverywhere() {
    setEverywhere(false);
    setPassword('');
    setProblem(undefined);
  }

  async function submitEverywhere() {
    if (!onSignOutEverywhere || busy || password.length === 0) return;
    setBusy(true);
    setProblem(undefined);
    try {
      const result = await onSignOutEverywhere(password);
      if (result.ok) return;
      setProblem(
        result.reason === 'wrong_password'
          ? msg('account.devices.wrongPassword')
          : result.reason === 'locked'
            ? msg('account.devices.locked', { minutes: String(result.minutes) })
            : msg('account.devices.failed'),
      );
    } catch {
      setProblem(msg('account.devices.failed'));
    } finally {
      setBusy(false);
    }
  }
  const others = devices.filter((d) => !d.current);
  const count = `${others.length} ${others.length === 1 ? 'device' : 'devices'}`;
  return (
    <section className="acct-card" data-gap="2" aria-labelledby="acct-devices">
      <div className="acct-row acct-devices__head" data-between data-wrap data-tight>
        <h2 id="acct-devices" className="acct-h2">
          {msg('account.whereYouAreSigned')}
        </h2>
        <div className="acct-row" data-wrap data-tight>
          {others.length > 0 ? (
            <Button variant="danger-outline" onClick={() => setConfirming(true)}>
              {msg('account.signOutAllOther')}
            </Button>
          ) : null}
          {onSignOutEverywhere ? (
            <Button variant="danger" onClick={() => setEverywhere(true)}>
              {msg('account.devices.everywhere')}
            </Button>
          ) : null}
        </div>
      </div>
      <ul className="acct-devices">
        {devices.map((d) => (
          <li key={d.id} className="acct-device">
            <div className="acct-device__lead">
              <AcctIcon name={iconFor(d)} size={24} />
              <div className="acct-col">
                <span className="acct-device__label">{d.label}</span>
                <span className="acct-muted acct-small">{`${d.place}, ${d.lastActive}`}</span>
              </div>
            </div>
            {d.current ? (
              <span className="acct-badge" data-tone="info">
                {msg('account.thisDevice')}
              </span>
            ) : (
              <Button
                variant="secondary"
                aria-label={msg('account.signOut2', { label: d.label })}
                onClick={() => void onRevoke(d.id)}
              >
                {msg('account.signOut')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={msg('account.signOutAllOther2')}
        className="acct-dialog"
        hideClose
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {msg('account.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirming(false);
                void onRevokeOthers();
              }}
            >
              {msg('account.signOut3', { count })}
            </Button>
          </>
        }
      >
        <p className="acct-muted">
          {msg('account.thisSignsYouOut', { value1: joinNames(others.map((d) => d.label)) })}
        </p>
      </Modal>
      <Modal
        open={everywhere}
        onClose={closeEverywhere}
        title={msg('account.devices.everywhereTitle')}
        className="acct-dialog"
        hideClose
        footer={
          <>
            <Button variant="secondary" onClick={closeEverywhere}>
              {msg('account.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={busy || password.length === 0}
              onClick={() => void submitEverywhere()}
            >
              {msg('account.devices.everywhere')}
            </Button>
          </>
        }
      >
        <p className="acct-muted">{msg('account.devices.everywhereLead')}</p>
        <AcctField
          label={msg('account.devices.passwordLabel')}
          type="password"
          autoComplete="current-password"
          value={password}
          error={problem}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submitEverywhere();
          }}
        />
      </Modal>
    </section>
  );
}
