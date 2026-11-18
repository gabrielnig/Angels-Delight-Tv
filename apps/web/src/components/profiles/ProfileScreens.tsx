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
import { ProfilePicker } from './ProfilePicker';

export function PickerScreen({
  profiles,
  max,
  mode,
  autoSkip,
}: {
  profiles: Profile[];
  max: number;
  mode: 'pick' | 'manage';
  autoSkip?: boolean;
}) {
  const router = useRouter();
  const [pinFor, setPinFor] = useState<Profile | null>(null);
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
      <ProfilePicker
        profiles={profiles}
        max={max}
        mode={mode}
        autoSkip={autoSkip}
        onExitManage={() => router.push('/profiles')}
        onSelect={async (id) => {
          const target = profiles.find((p) => p.id === id);
          if (target?.hasPin) {
            setPinFor(target);
            return;
          }
          const result = await selectProfileAction(id);
          if (result.ok) enter();
          else if (result.reason === 'pin_required' && target) setPinFor(target);
        }}
        onSignOut={async () => {
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
}: {
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
