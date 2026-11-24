'use client';

import { useState } from 'react';
import { SignInToSaveDialog } from '@/components/guest/SignInToSaveDialog';

interface Props {
  videoId: string;
  title: string;
  initialInMyList: boolean;
  /** Persists the change. The fixture keeps it local. Lane C provides the real call. */
  onToggleMyList?: (videoId: string, next: boolean) => Promise<void>;
  /** A visitor without an account: My List opens the Sign in to save dialog and nothing is stored (M40). */
  guest?: { signUpOpen: boolean };
}

/** My List and Share under the player (M10, M08-S26). Optimistic with rollback. */
export function WatchActions({ videoId, title, initialInMyList, onToggleMyList, guest }: Props) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [inList, setInList] = useState(initialInMyList);
  const [note, setNote] = useState('');

  async function toggle() {
    if (guest) {
      setSaveOpen(true);
      return;
    }
    const next = !inList;
    setInList(next);
    try {
      await onToggleMyList?.(videoId, next);
      setNote(next ? 'Added to My List' : 'Removed from My List');
    } catch {
      setInList(!next);
      setNote('Could not update My List. Try again.');
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote('Link copied');
    } catch {
      setNote('Could not share this video');
    }
  }

  return (
    <div className="watch__actions">
      <button
        type="button"
        className="watch__button"
        {...(guest ? { 'aria-haspopup': 'dialog' as const } : { 'aria-pressed': inList })}
        onClick={() => void toggle()}
      >
        {inList && !guest ? 'In My List' : '+ My List'}
      </button>
      <button type="button" className="watch__button" onClick={() => void share()}>
        Share
      </button>
      <span className="watch__note" role="status">
        {note}
      </span>
      {guest ? (
        <SignInToSaveDialog
          open={saveOpen}
          reason="my-list"
          intent={{ kind: 'my-list', itemKey: `video:${videoId}` }}
          next={`/watch/${videoId}`}
          signUpOpen={guest.signUpOpen}
          onClose={() => setSaveOpen(false)}
        />
      ) : null}
    </div>
  );
}
