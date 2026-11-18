'use client';

import { useRouter } from 'next/navigation';
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
  return (
    <ProfilePicker
      profiles={profiles}
      max={max}
      mode={mode}
      autoSkip={autoSkip}
      onExitManage={() => router.push('/profiles')}
      onSelect={async (id) => {
        await selectProfileAction(id);
        // A failed purge forces a full reload so nothing of the last profile is shown (M03-S14).
        if (!clearServiceWorkerCaches(navigator)) {
          window.location.assign('/');
          return;
        }
        router.push('/');
        router.refresh();
      }}
      onSignOut={async () => {
        await signOutAction();
        clearServiceWorkerCaches(navigator);
        router.push('/');
        router.refresh();
      }}
    />
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
