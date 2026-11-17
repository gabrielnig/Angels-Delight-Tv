'use client';

import { useActionState } from 'react';
import { Button } from '@/components/admin/Button';
import { TextField } from '@/components/admin/fields';
import { verifyCodeAction } from '../actions';
import type { CodeState } from '../actions';

/** Recovery code entry for staff who lost their authenticator (M12-S03). */
export function RecoveryForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<CodeState, FormData>(verifyCodeAction, {});
  return (
    <form action={action} className="adm-stack">
      <input type="hidden" name="next" value={next} />
      {state.error ? (
        <p role="alert" className="adm-field__error">
          {state.error}
        </p>
      ) : null}
      <TextField
        label="Recovery code"
        name="code"
        autoComplete="off"
        autoCapitalize="none"
        required
      />
      <Button type="submit" variant="primary" loading={pending}>
        Use recovery code
      </Button>
    </form>
  );
}
