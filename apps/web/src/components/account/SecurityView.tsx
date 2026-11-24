'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import {
  revokeDeviceAction,
  revokeOtherDevicesAction,
  signOutEverywhereAction,
} from '../../app/actions';
import type { DeviceSession, LoginHistoryEntry, TwoFactorState } from '../../lib/data';
import { ChangePasswordForm } from './ChangePassword';
import { DevicesCard, type SignOutEverywhereResult } from './DevicesPanel';
import { EmailCard } from './EmailCard';
import { InlineToast } from './InlineToast';
import { LoginHistoryCard } from './LoginHistoryCard';
import { TwoFactorCard } from './TwoFactorCard';
import { msg } from '@ad/shared/messages';

/** The security screen body (S28): toast slot, Password, Email, signed in devices. */
export function SecurityView({
  email,
  verified,
  passwordChanged,
  devices: initial,
  twoFactor,
  history,
  revoke = revokeDeviceAction,
  revokeOthers = revokeOtherDevicesAction,
  signOutEverywhere = signOutEverywhereAction,
}: {
  email: string;
  verified: boolean;
  passwordChanged: string;
  devices: DeviceSession[];
  twoFactor?: TwoFactorState;
  history?: LoginHistoryEntry[];
  revoke?: (id: string) => Promise<unknown>;
  revokeOthers?: () => Promise<unknown>;
  signOutEverywhere?: (password: string) => Promise<SignOutEverywhereResult>;
}) {
  const router = useRouter();
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

  async function onSignOutEverywhere(password: string): Promise<SignOutEverywhereResult> {
    const result = await signOutEverywhere(password);
    if (result.ok) router.push('/sign-in?notice=everywhere');
    return result;
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
      <DevicesCard
        devices={devices}
        onRevoke={onRevoke}
        onRevokeOthers={onRevokeOthers}
        onSignOutEverywhere={onSignOutEverywhere}
      />
      {history ? <LoginHistoryCard entries={history} /> : null}
    </>
  );
}
