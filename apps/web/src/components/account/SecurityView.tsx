'use client';

import { useCallback, useState } from 'react';
import { revokeDeviceAction, revokeOtherDevicesAction } from '../../app/actions';
import type { DeviceSession, TwoFactorState } from '../../lib/data';
import { ChangePasswordForm } from './ChangePassword';
import { DevicesCard } from './DevicesPanel';
import { EmailCard } from './EmailCard';
import { InlineToast } from './InlineToast';
import { TwoFactorCard } from './TwoFactorCard';
import { msg } from '@ad/shared/messages';

/** The security screen body (S28): toast slot, Password, Email, signed in devices. */
export function SecurityView({
  email,
  verified,
  passwordChanged,
  devices: initial,
  twoFactor,
  revoke = revokeDeviceAction,
  revokeOthers = revokeOtherDevicesAction,
}: {
  email: string;
  verified: boolean;
  passwordChanged: string;
  devices: DeviceSession[];
  twoFactor?: TwoFactorState;
  revoke?: (id: string) => Promise<unknown>;
  revokeOthers?: () => Promise<unknown>;
}) {
  const [devices, setDevices] = useState(initial);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const dismiss = useCallback(() => setToast(null), []);

  async function onRevoke(id: string) {
    try {
      await revoke(id);
      setDevices((d) => d.filter((x) => x.id !== id));
      setToast({ text: 'Device signed out.' });
    } catch {
      setToast({ text: 'We could not sign that device out. Try again.', error: true });
    }
  }

  async function onRevokeOthers() {
    try {
      await revokeOthers();
      setDevices((d) => d.filter((x) => x.current));
      setToast({ text: 'Other devices signed out.' });
    } catch {
      setToast({ text: 'We could not sign the other devices out. Try again.', error: true });
    }
  }

  return (
    <>
      {toast ? (
        toast.error ? (
          <p className="acct-notice" data-tone="error" role="alert">
            <span className="acct-notice__text">{toast.text}</span>
          </p>
        ) : (
          <InlineToast message={toast.text} onDismiss={dismiss} />
        )
      ) : null}
      <ChangePasswordForm
        lastChanged={passwordChanged}
        onChanged={(n) => {
          setDevices((d) => d.filter((x) => x.current));
          setToast({
            text:
              n === 0
                ? 'Password updated.'
                : `Password updated. We signed you out on ${n} other ${n === 1 ? 'device' : 'devices'}.`,
          });
        }}
      />
      {twoFactor ? (
        <TwoFactorCard
          initial={twoFactor}
          onChanged={(change) =>
            setToast({
              text:
                change === 'on' ? msg('account.twoStep.onDone') : msg('account.twoStep.offDone'),
            })
          }
        />
      ) : null}
      <EmailCard
        email={email}
        verified={verified}
        onChanged={() => setToast({ text: 'Email changed.' })}
      />
      <DevicesCard devices={devices} onRevoke={onRevoke} onRevokeOthers={onRevokeOthers} />
    </>
  );
}
