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
import { ProfileForm } from './ProfileForm';
import { ProfilePicker } from './ProfilePicker';

export function PickerScreen({ profiles, max, mode, autoSkip }: { profiles: Profile[]; max: number; mode: 'pick' | 'manage'; autoSkip?: boolean }) {
  const router = useRouter();
  return (
    <ProfilePicker
      profiles={profiles}
      max={max}
      mode={mode}
      autoSkip={autoSkip}
      onSelect={async (id) => {
        await selectProfileAction(id);
        router.push('/');
        router.refresh();
      }}
      onSignOut={async () => {
        await signOutAction();
        router.push('/');
        router.refresh();
      }}
    />
  );
}

export function EditScreen({ profile, limitReached, lastAdult }: { profile?: Profile; limitReached: boolean; lastAdult: boolean }) {
  const router = useRouter();
  const done = () => {
    router.push('/profiles/manage');
    router.refresh();
  };
  return (
    <ProfileForm
      profile={profile}
      limitReached={limitReached}
      lastAdult={lastAdult}
      onDone={done}
      onSave={(input) =>
        profile
          ? updateProfileAction(profile.id, input).then((result) => (result.ok ? { ok: true as const } : result))
          : createProfileAction(input).then((result) => (result.ok ? { ok: true as const } : result))
      }
      onDelete={profile ? () => deleteProfileAction(profile.id) : undefined}
    />
  );
}
