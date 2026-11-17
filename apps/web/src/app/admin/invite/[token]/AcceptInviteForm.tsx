'use client';

import { useActionState } from 'react';
import { Button } from '@/components/admin/Button';
import { TextField } from '@/components/admin/fields';
import { acceptInviteAction } from './actions';
import type { InviteState } from './actions';

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(acceptInviteAction, {});
  return (
    <form action={action} className="adm-stack" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <p role="alert" className="adm-field__error">
          {state.error}
        </p>
      ) : null}
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={state.fields?.password}
      />
      <Button type="submit" variant="primary" loading={pending}>
        Create account
      </Button>
    </form>
  );
}
