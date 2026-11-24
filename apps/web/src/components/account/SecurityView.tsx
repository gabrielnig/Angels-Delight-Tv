'use client';

import { useT } from '../../lib/i18n/provider';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import {
  revokeDeviceAction,
  revokeOtherDevicesAction,
  signOutEverywhereAction,
} from '../../app/actions';
import type { DeviceSession, LoginHistoryEntry, TwoFactorState } from '../../lib/data';
import { ChangePasswordForm } from './ChangePassword';
import { ConnectedSignInCard, type GoogleCardState } from './ConnectedSignInCard';
import { DevicesCard, type SignOutEverywhereResult } from './DevicesPanel';
import { EmailCard } from './EmailCard';
import { InlineToast } from './InlineToast';
import { LoginHistoryCard } from './LoginHistoryCard';
import { TwoFactorCard } from './TwoFactorCard';

/** The security screen body (S28): toast slot, Password, Email, signed in devices. */
export function SecurityView({
  email,
  verified,
  passwordChanged,
  devices: initial,
  twoFactor,
  history,
  google,
  notice,
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
  /** Null or missing when Google sign in is not configured, so the card is absent. */
  google?: GoogleCardState | null;
  /** A notice carried back from another screen, such as `google` after connecting. */
  notice?: string;
  revoke?: (id: string) => Promise<unknown>;
  revokeOthers?: () => Promise<unknown>;
  signOutEverywhere?: (password: string) => Promise<SignOutEverywhereResult>;
}) {
  const msg = useT();
  const router = useRouter();
  const [devices, setDevices] = useState(initial);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
    notice === 'google' ? { text: msg('account.google.connectedDone') } : null,
  );
  const dismiss = useCallback(() => setToast(null), []);

  async function onRevoke(id: string) {
    try {
      await revoke(id);
      setDevices((d) => d.filter((x) => x.id !== id));
      setToast({ text: msg('account.deviceSignedOut') });
    } catch {
      setToast({ text: msg('account.weCouldNotSign'), error: true });
    }
  }

  async function onRevokeOthers() {
    try {
      await revokeOthers();
      setDevices((d) => d.filter((x) => x.current));
      setToast({ text: msg('account.otherDevicesSignedOut') });
    } catch {
      setToast({ text: msg('account.weCouldNotSign2'), error: true });
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
                ? msg('account.passwordUpdated')
                : msg('account.passwordUpdatedWeSigned', { count: n }),
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
      {google ? (
        <ConnectedSignInCard
          initial={google}
          onChanged={() => setToast({ text: msg('account.google.unlinkDone') })}
        />
      ) : null}
      <EmailCard
        email={email}
        verified={verified}
        onChanged={() => setToast({ text: msg('account.emailChanged') })}
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
