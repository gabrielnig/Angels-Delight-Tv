'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  createProfileAction,
  deleteProfileAction,
  selectProfileAction,
  signOutAction,
  updateProfileAction,
} from '../../app/actions';
import type { Profile } from '../../lib/data';
import { clearServiceWorkerCaches } from '../../lib/pwa/purge';
import { ProfileForm } from './ProfileForm';
import { PinDialog } from './PinDialog';
import { clearPickerCache, type PickerProfile } from '../../lib/profiles/picker-cache';
import { CachedPicker } from './CachedPicker';

export function PickerScreen({
  accountId,
  profiles,
  max,
  mode,
  autoSkip,
}: {
  accountId: string;
  /** Null when the list could not be loaded, 'loading' while it is on its way: the cached list is drawn (M03-S13). */
  profiles: Profile[] | null | 'loading';
  max: number;
  mode: 'pick' | 'manage';
  autoSkip?: boolean;
}) {
  const router = useRouter();
  const [pinFor, setPinFor] = useState<PickerProfile | null>(null);
  const enter = () => {
    // A failed purge forces a full reload so nothing of the last profile is shown (M03-S14).
    if (!clearServiceWorkerCaches(navigator)) {
      window.location.assign('/');
      return;
    }
    router.push('/');
    router.refresh();
  };
  return (
    <>
      <CachedPicker
        accountId={accountId}
        fresh={profiles}
        onRetry={() => router.refresh()}
        max={max}
        mode={mode}
        autoSkip={autoSkip}
        onExitManage={() => router.push('/profiles')}
        onSelect={async (target) => {
          if (target.hasPin) {
            setPinFor(target);
            return;
          }
          const result = await selectProfileAction(target.id);
          if (result.ok) enter();
          else if (result.reason === 'pin_required') setPinFor(target);
        }}
        onSignOut={async () => {
          clearPickerCache(localStorage);
          await signOutAction();
          clearServiceWorkerCaches(navigator);
          router.push('/');
          router.refresh();
        }}
      />
      {pinFor ? (
        <PinDialog
          open
          profileName={pinFor.name}
          onSubmit={(proof) => selectProfileAction(pinFor.id, proof)}
          onUnlocked={() => {
            setPinFor(null);
            enter();
          }}
          onClose={() => setPinFor(null)}
        />
      ) : null}
    </>
  );
}

export function EditScreen({
  profile,
  limitReached,
  lastAdult,
  suggestedName,
  languages,
}: {
  languages?: readonly string[];
  suggestedName?: string;
  profile?: Profile;
  limitReached: boolean;
  lastAdult: boolean;
}) {
  const router = useRouter();
  const done = () => {
    router.push('/profiles/manage');
    router.refresh();
  };
  return (
    <ProfileForm
      profile={profile}
      suggestedName={suggestedName}
      languages={languages}
      limitReached={limitReached}
      lastAdult={lastAdult}
      onDone={done}
      onSave={(input) =>
        profile
          ? updateProfileAction(profile.id, input).then((result) =>
              result.ok ? { ok: true as const } : result,
            )
          : createProfileAction(input).then((result) =>
              result.ok ? { ok: true as const } : result,
            )
      }
      onDelete={profile ? () => deleteProfileAction(profile.id) : undefined}
    />
  );
}
