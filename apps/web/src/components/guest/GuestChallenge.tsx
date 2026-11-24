'use client';

import { msg } from '@ad/shared/messages';
import { Button, Modal } from '@ad/ui';
import { TurnstileWidget } from '../auth/TurnstileWidget';

/**
 * S89. Shown only when the server asks a visitor to prove they are a person before a video starts, after repeated
 * refusals from their network. One action: Cancel. Passing the check continues playback on its own (M40-S11).
 */
export function GuestChallenge({
  open,
  siteKey,
  onToken,
  onCancel,
}: {
  open: boolean;
  siteKey: string;
  onToken: (token: string) => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={msg('guest.challenge.title')}
      dismissOnScrim={false}
      hideClose
      footer={
        <Button variant="ghost" onClick={onCancel}>
          {msg('guest.challenge.cancel')}
        </Button>
      }
    >
      <p>{msg('guest.challenge.body')}</p>
      <TurnstileWidget siteKey={siteKey} onToken={(token) => token && onToken(token)} />
    </Modal>
  );
}
