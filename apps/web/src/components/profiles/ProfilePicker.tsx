'use client';

import { useT } from '../../lib/i18n/provider';
import { useEffect, type ReactNode } from 'react';
import {
  AddProfileTile,
  Button,
  ButtonLink,
  ErrorState,
  ProfileTile,
  Skeleton,
  SkeletonRegion,
  type AvatarTone,
} from '@ad/ui';
import type { Profile } from '../../lib/data';

const TONES = ['sky', 'mint', 'lemon', 'peach', 'lavender'];
const asTone = (tone?: string): AvatarTone | undefined =>
  tone && TONES.includes(tone) ? (tone as AvatarTone) : undefined;

/** Screens 9 and 10: who is watching, and manage mode. */
export function ProfilePicker({
  profiles,
  max,
  mode = 'pick',
  loading,
  error,
  onRetry,
  onSignOut,
  autoSkip,
  note,
  onSelect,
  onExitManage,
}: {
  profiles: Profile[];
  max: number;
  mode?: 'pick' | 'manage';
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onSignOut?: () => void;
  /** Skip the picker when the account has exactly one profile. */
  autoSkip?: boolean;
  /** A small status line under the tiles, for example that the list may be out of date (M03-S13). */
  note?: string;
  onSelect: (profileId: string) => void;
  /** Escape leaves manage mode (M03-S06). */
  onExitManage?: () => void;
}) {
  const msg = useT();
  useEffect(() => {
    const only = profiles[0];
    if (autoSkip && profiles.length === 1 && only) onSelect(only.id);
    // Runs once for the profiles the page loaded with.
  }, []);

  const managing = mode === 'manage';
  useEffect(() => {
    if (!managing || !onExitManage) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExitManage();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [managing, onExitManage]);
  const full = profiles.length >= max;

  let body: ReactNode;
  if (loading) {
    body = (
      <SkeletonRegion label="Loading profiles">
        <ul className="web-tiles" aria-hidden="true">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className="web-tiles__skel">
              <Skeleton circle width="7.5rem" height="7.5rem" />
              <Skeleton width="5rem" height="1rem" />
            </li>
          ))}
        </ul>
      </SkeletonRegion>
    );
  } else if (error) {
    body = (
      <ErrorState
        title={msg('profiles.weCouldNotLoad')}
        description="Check your connection and try once more."
        onRetry={onRetry}
        retryLabel="Retry"
        actions={
          onSignOut ? (
            <Button variant="secondary" onClick={onSignOut}>
              {msg('profiles.signOut')}
            </Button>
          ) : undefined
        }
      />
    );
  } else if (profiles.length === 0) {
    body = (
      <div className="web-first">
        <h1 className="web-picker__title">{msg('profiles.createYourFirstProfile')}</h1>
        <p className="web-muted">{msg('profiles.profilesKeepWatchHistory')}</p>
        <ButtonLink href="/profiles/new" size="lg">
          {msg('profiles.createProfile')}
        </ButtonLink>
      </div>
    );
  } else {
    body = (
      <>
        <h1 className="web-picker__title">
          {managing ? msg('profiles.manageProfiles') : msg('profiles.whoIsWatching')}
        </h1>
        {managing ? <p className="web-muted">{msg('profiles.chooseAProfileTo')}</p> : null}
        <ul className="web-tiles" role="list" aria-label={msg('profiles.profiles')}>
          {profiles.map((profile) => (
            <li key={profile.id}>
              {managing ? (
                <ProfileTile
                  name={profile.name}
                  tone={asTone(profile.tone)}
                  avatarId={profile.avatarId}
                  kids={profile.kids}
                  editing
                  href={`/profiles/${profile.id}/edit`}
                />
              ) : (
                <ProfileTile
                  name={profile.name}
                  tone={asTone(profile.tone)}
                  avatarId={profile.avatarId}
                  kids={profile.kids}
                  onSelect={() => onSelect(profile.id)}
                />
              )}
            </li>
          ))}
          {!full ? (
            <li>
              <AddProfileTile href="/profiles/new" />
            </li>
          ) : null}
        </ul>
        {note ? (
          <p role="status" className="web-muted">
            {note}
          </p>
        ) : null}
        {full ? (
          <p className="web-muted">
            {managing
              ? msg('profiles.youHaveProfilesThe', { max })
              : msg('profiles.youHaveProfilesThe2', { max })}
          </p>
        ) : null}
        <div className="web-picker__actions">
          {managing ? (
            <ButtonLink href="/profiles" size="lg">
              {msg('profiles.done')}
            </ButtonLink>
          ) : (
            <ButtonLink href="/profiles/manage" variant="secondary" size="lg">
              {msg('profiles.manageProfiles')}
            </ButtonLink>
          )}
        </div>
      </>
    );
  }

  return <div className="web-picker">{body}</div>;
}
