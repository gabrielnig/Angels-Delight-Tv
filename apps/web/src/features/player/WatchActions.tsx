'use client';

import { useT } from '../../lib/i18n/provider';
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
  /** Opens the Share sheet. Left out when sharing is off for this viewer (a kids profile). */
  onShare?: () => void;
}

/** My List and Share under the player (M10, M08-S26). Optimistic with rollback. */
export function WatchActions({ videoId, initialInMyList, onToggleMyList, guest, onShare }: Props) {
  const msg = useT();
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
      setNote(next ? msg('watch.addedToMyList') : msg('watch.removedFromMyList'));
    } catch {
      setInList(!next);
      setNote(msg('watch.couldNotUpdateMy'));
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
        {inList && !guest ? msg('watch.inMyList') : '+ My List'}
      </button>
      {onShare ? (
        <button type="button" className="watch__button" aria-haspopup="dialog" onClick={onShare}>
          {msg('watch.share')}
        </button>
      ) : null}
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
