'use client';

import { msg } from '@ad/shared/messages';
import { Button, ButtonLink, Modal } from '@ad/ui';
import { saveIntent, type GuestIntent } from '../../lib/guest/intent';

export type SaveReason = 'my-list' | 'like';

export interface SignInToSaveDialogProps {
  open: boolean;
  reason: SaveReason;
  /** The page to return to after signing in or creating an account. */
  next: string;
  signUpOpen: boolean;
  /** What to do for them after they sign in. Remembered on this device only when they follow a link. */
  intent?: GuestIntent;
  onClose: () => void;
}

/** S83. Saving needs an account, watching does not, so the dialog says both and offers one way forward. */
export function SignInToSaveDialog({
  open,
  reason,
  next,
  signUpOpen,
  intent,
  onClose,
}: SignInToSaveDialogProps) {
  const remember = () => {
    if (intent) saveIntent(window.localStorage, intent);
  };
  const key = reason === 'like' ? 'like' : 'myList';
  const query = `?next=${encodeURIComponent(next)}`;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={msg(`guest.save.${key}.title`)}
      hideClose
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {msg('guest.save.notNow')}
          </Button>
          {signUpOpen ? (
            <ButtonLink href={`/sign-up${query}`} variant="secondary" onClick={remember}>
              {msg('guest.save.createAccount')}
            </ButtonLink>
          ) : null}
          <ButtonLink href={`/sign-in${query}`} onClick={remember}>
            {msg('guest.save.signIn')}
          </ButtonLink>
        </>
      }
    >
      <p>{msg(`guest.save.${key}.body`)}</p>
    </Modal>
  );
}
