'use client';

import { useState, type FormEvent } from 'react';
import { Banner, Button, PasswordField } from '@ad/ui';
import { changePasswordAction } from '../../app/actions';
import { NETWORK_MESSAGE } from '../auth/shared';

type Result =
  | { ok: true; signedOutDevices: number }
  | { ok: false; reason: 'wrong_current' | 'weak' | 'network' };

export function ChangePasswordForm({
  change = changePasswordAction,
}: {
  change?: (input: { current: string; next: string }) => Promise<Result>;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string }>({});
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setNotice(null);
    if (!current) {
      setErrors({ current: 'Enter your current password.' });
      form.querySelector<HTMLInputElement>('input')?.focus();
      return;
    }
    if (!next) {
      setErrors({ next: 'Choose a new password.' });
      form.querySelectorAll<HTMLInputElement>('input')[1]?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const result = await change({ current, next });
      if (result.ok) {
        setCurrent('');
        setNext('');
        const n = result.signedOutDevices;
        setNotice({
          tone: 'success',
          text: `Password changed. ${n} other ${n === 1 ? 'device was' : 'devices were'} signed out.`,
        });
      } else if (result.reason === 'wrong_current') {
        setErrors({ current: 'That is not your current password.' });
      } else if (result.reason === 'weak') {
        setErrors({ next: 'Choose a longer, less common password.' });
      } else {
        setNotice({ tone: 'danger', text: NETWORK_MESSAGE });
      }
    } catch {
      setNotice({ tone: 'danger', text: NETWORK_MESSAGE });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="web-form" onSubmit={(event) => void onSubmit(event)} noValidate>
      {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}
      <PasswordField
        label="Current password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        error={errors.current}
      />
      <PasswordField
        label="New password"
        mode="new"
        showStrength
        value={next}
        onChange={(e) => setNext(e.target.value)}
        error={errors.next}
      />
      <Button type="submit" loading={busy}>
        Change password
      </Button>
    </form>
  );
}
