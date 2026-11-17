'use client';

import { useState } from 'react';
import { Button, Modal, PasswordField } from '@ad/ui';
import { checkKidsPasswordAction } from '../app/actions';

type Check = (password: string) => Promise<
  { ok: true } | { ok: false; reason: 'wrong'; triesLeft: number } | { ok: false; reason: 'locked'; minutes: number }
>;

/** Screen 13. Leaving Kids mode needs the account password. */
export function KidsExitDialog({
  open,
  onClose,
  onUnlocked,
  check = checkKidsPasswordAction,
}: {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
  check?: Check;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!password) {
      setError('Enter your account password.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const result = await check(password);
      if (result.ok) {
        setPassword('');
        onUnlocked();
      } else if (result.reason === 'locked') {
        setLocked(true);
        setError(`Too many tries. Try again in ${result.minutes} minutes.`);
      } else {
        setError(
          `That password is not right. Check it and try again. You have ${result.triesLeft} ${result.triesLeft === 1 ? 'try' : 'tries'} left.`,
        );
      }
    } catch {
      setError('We could not check that. Check your data or Wi-Fi, then try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setPassword('');
        setError(undefined);
        onClose();
      }}
      title="Leave Kids mode"
      dismissOnScrim={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="kids-exit-form" loading={busy} disabled={locked}>
            {busy ? 'Checking' : 'Continue'}
          </Button>
        </>
      }
    >
      <form id="kids-exit-form" onSubmit={submit} noValidate>
        <p className="web-muted">Enter your account password to switch to an adult profile.</p>
        <PasswordField
          label="Account password (required)"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          mode="current"
          error={error}
          disabled={locked}
        />
      </form>
    </Modal>
  );
}
