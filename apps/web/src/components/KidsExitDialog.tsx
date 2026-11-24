'use client';

import { useState } from 'react';
import { Button, Modal, PasswordField } from '@ad/ui';
import { checkKidsPasswordAction } from '../app/actions';
import { useT } from '../lib/i18n/provider';

type Check = (
  password: string,
) => Promise<
  | { ok: true }
  | { ok: false; reason: 'wrong'; triesLeft: number }
  | { ok: false; reason: 'locked'; minutes: number }
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
  const msg = useT();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!password) {
      setError(msg('kidsExit.enterPassword'));
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
        setError(msg('kidsExit.locked', { minutes: result.minutes }));
      } else {
        setError(msg('kidsExit.wrong', { count: result.triesLeft }));
      }
    } catch {
      setError(msg('kidsExit.network'));
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
      title={msg('kidsExit.title')}
      dismissOnScrim={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {msg('kidsExit.cancel')}
          </Button>
          <Button type="submit" form="kids-exit-form" loading={busy} disabled={locked}>
            {busy ? msg('kidsExit.checking') : msg('kidsExit.continue')}
          </Button>
        </>
      }
    >
      <form id="kids-exit-form" onSubmit={submit} noValidate>
        <p className="web-muted">{msg('kidsExit.intro')}</p>
        <PasswordField
          label={msg('kidsExit.password')}
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
