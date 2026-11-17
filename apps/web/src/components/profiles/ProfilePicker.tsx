'use client';

import { useEffect, type ReactNode } from 'react';
import { AddProfileTile, Button, ButtonLink, ErrorState, ProfileTile, Skeleton, SkeletonRegion, type AvatarTone } from '@ad/ui';
import type { Profile } from '../../lib/data';

const TONES = ['sky', 'mint', 'lemon', 'peach', 'lavender'];
const asTone = (tone?: string): AvatarTone | undefined => (tone && TONES.includes(tone) ? (tone as AvatarTone) : undefined);

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
  onSelect,
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
  onSelect: (profileId: string) => void;
}) {
  useEffect(() => {
    const only = profiles[0];
    if (autoSkip && profiles.length === 1 && only) onSelect(only.id);
    // Runs once for the profiles the page loaded with.
  }, []);

  const managing = mode === 'manage';
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
        title="We could not load profiles. Try again."
        description="Check your connection and try once more."
        onRetry={onRetry}
        retryLabel="Retry"
        actions={
          onSignOut ? (
            <Button variant="secondary" onClick={onSignOut}>
              Sign out
            </Button>
          ) : undefined
        }
      />
    );
  } else if (profiles.length === 0) {
    body = (
      <div className="web-first">
        <h1 className="web-picker__title">Create your first profile</h1>
        <p className="web-muted">
          Profiles keep watch history and My List separate. Add one for yourself, then one for each child.
        </p>
        <ButtonLink href="/profiles/new" size="lg">
          Create profile
        </ButtonLink>
      </div>
    );
  } else {
    body = (
      <>
        <h1 className="web-picker__title">{managing ? 'Manage profiles' : 'Who is watching?'}</h1>
        {managing ? (
          <p className="web-muted">Choose a profile to change its name, picture or Kids setting.</p>
        ) : null}
        <ul className="web-tiles" role="list" aria-label="Profiles">
          {profiles.map((profile) => (
            <li key={profile.id}>
              {managing ? (
                <ProfileTile
                  name={profile.name}
                  tone={asTone(profile.tone)}
                  kids={profile.kids}
                  editing
                  href={`/profiles/${profile.id}/edit`}
                />
              ) : (
                <ProfileTile
                  name={profile.name}
                  tone={asTone(profile.tone)}
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
        {full ? (
          <p className="web-muted">
            {managing
              ? `You have ${max} profiles, the most we allow.`
              : `You have ${max} profiles, the most we allow. Delete one to add another.`}
          </p>
        ) : null}
        <div className="web-picker__actions">
          {managing ? (
            <ButtonLink href="/profiles" size="lg">
              Done
            </ButtonLink>
          ) : (
            <ButtonLink href="/profiles/manage" variant="secondary" size="lg">
              Manage profiles
            </ButtonLink>
          )}
        </div>
      </>
    );
  }

  return <div className="web-picker">{body}</div>;
}
