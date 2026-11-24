'use client';

import { useEffect, useState } from 'react';
import { SignInToSaveDialog } from '../guest/SignInToSaveDialog';
import { RatingControl, type RatingValue } from './RatingControl';

export interface RatingTarget {
  profileId: string;
  kind: 'video' | 'series';
  id: string;
}

export interface TitleRatingProps {
  /** An adult profile on an account. Absent for guests. */
  target?: RatingTarget;
  /** A visitor without an account: a tap opens the Sign in to save dialog (R01). */
  guest?: { signUpOpen: boolean; next: string; itemKey: string };
}

async function readJson(response: Response) {
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

/** The rating group of the title page. Loads this profile's rating, saves through the API (M44-S01, S04). */
export function TitleRating({ target, guest }: TitleRatingProps) {
  const [initial, setInitial] = useState<RatingValue | null | undefined>(guest ? null : undefined);
  const [asking, setAsking] = useState<{ value: RatingValue } | null>(null);

  useEffect(() => {
    if (!target) return;
    let live = true;
    const query = new URLSearchParams({ profileId: target.profileId, kind: target.kind, id: target.id });
    fetch(`/api/ratings?${query}`)
      .then(readJson)
      .then((body: { value: RatingValue | null }) => live && setInitial(body.value ?? null))
      .catch(() => live && setInitial(null));
    return () => {
      live = false;
    };
  }, [target]);

  if (initial === undefined) return null;
  return (
    <>
      <RatingControl
        key={String(initial)}
        initial={initial}
        guest={Boolean(guest)}
        onGuestAsk={(value) => setAsking({ value })}
        save={async (value) => {
          if (!target) return;
          await readJson(
            await fetch('/api/ratings', {
              method: 'PUT',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                profileId: target.profileId,
                target: { kind: target.kind, id: target.id },
                value,
              }),
            }),
          );
        }}
      />
      {guest ? (
        <SignInToSaveDialog
          open={asking !== null}
          reason="like"
          next={guest.next}
          signUpOpen={guest.signUpOpen}
          intent={{ kind: 'like', itemKey: guest.itemKey, value: asking?.value }}
          onClose={() => setAsking(null)}
        />
      ) : null}
    </>
  );
}
