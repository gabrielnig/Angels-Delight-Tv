'use client';

import { msg } from '@ad/shared/messages';
import { Button, ButtonLink, Modal } from '@ad/ui';

export type SaveReason = 'my-list' | 'like';

export interface SignInToSaveDialogProps {
  open: boolean;
  reason: SaveReason;
  /** The page to return to after signing in or creating an account. */
  next: string;
  signUpOpen: boolean;
  onClose: () => void;
}

/** S83. Saving needs an account, watching does not, so the dialog says both and offers one way forward. */
export function SignInToSaveDialog({
  open,
  reason,
  next,
  signUpOpen,
  onClose,
}: SignInToSaveDialogProps) {
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
            <ButtonLink href={`/sign-up${query}`} variant="secondary">
              {msg('guest.save.createAccount')}
            </ButtonLink>
          ) : null}
          <ButtonLink href={`/sign-in${query}`}>{msg('guest.save.signIn')}</ButtonLink>
        </>
      }
    >
      <p>{msg(`guest.save.${key}.body`)}</p>
    </Modal>
  );
}
