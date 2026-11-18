'use client';

import { useState, type FormEvent } from 'react';
import { Button, Modal, OtpInput, PasswordField } from '@ad/ui';
import type { SelectProfileResult } from '../../lib/data';

/**
 * M03-S12: the PIN screen for a protected profile. Four digits on a numeric keypad, submitted on the last digit.
 * The server counts the tries and locks, so this only shows what it says. The account password opens the profile
 * when the PIN is forgotten or locked.
 */
export function PinDialog({
  open,
  profileName,
  onSubmit,
  onUnlocked,
  onClose,
}: {
  open: boolean;
  profileName: string;
  onSubmit: (input: { pin: string } | { password: string }) => Promise<SelectProfileResult>;
  onUnlocked: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'pin' | 'password'>('pin');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  function reset() {
    setMode('pin');
    setPin('');
    setPassword('');
    setError(undefined);
  }

  async function send(input: { pin: string } | { password: string }) {
    setBusy(true);
    setError(undefined);
    try {
      const result = await onSubmit(input);
      if (result.ok) {
        reset();
        onUnlocked();
        return;
      }
      if (result.reason === 'locked') {
        setError(
          `Too many tries. Try again in ${result.minutes ?? 5} minutes, or use your account password.`,
        );
      } else if (result.reason === 'password_incorrect') {
        setError('That password is not right. Check it and try again.');
      } else {
        setError('That PIN is not right. Try again.');
      }
      setPin('');
    } catch {
      setError('We could not check that. Check your data or Wi-Fi, then try again.');
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (!password) {
      setError('Enter your account password.');
      return;
    }
    void send({ password });
  }

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={`Enter PIN for ${profileName}`}
      dismissOnScrim={false}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          {mode === 'password' ? (
            <Button type="submit" form="pin-password-form" loading={busy}>
              Continue
            </Button>
          ) : null}
        </>
      }
    >
      {mode === 'pin' ? (
        <div className="web-form">
          <OtpInput
            length={4}
            label={`Enter the 4 digit PIN for ${profileName}`}
            value={pin}
            onChange={setPin}
            onComplete={(value) => void send({ pin: value })}
            error={error}
            loading={busy}
            autoFocus
          />
          <Button
            variant="ghost"
            onClick={() => {
              setMode('password');
              setError(undefined);
            }}
          >
            Use account password instead
          </Button>
        </div>
      ) : (
        <form id="pin-password-form" className="web-form" onSubmit={submitPassword} noValidate>
          <p className="web-muted">Enter your account password to open this profile.</p>
          <PasswordField
            label="Account password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            mode="current"
            error={error}
          />
          <Button
            variant="ghost"
            onClick={() => {
              setMode('pin');
              setError(undefined);
            }}
          >
            Use PIN instead
          </Button>
        </form>
      )}
    </Modal>
  );
}
